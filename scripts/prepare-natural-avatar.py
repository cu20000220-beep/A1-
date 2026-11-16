#!/usr/bin/env python3
"""Offline, pinned sample conversion; no downloads, personal inputs or service calls.

Requires Python/Pillow and the project's Node runtime. Only embedded image bytes
and buffer offsets change. Face/hair maps and every geometry/skin/morph byte are
preserved. The output is a candidate, never an automatic visual-quality approval.
"""
import argparse
import copy
import hashlib
import io
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile

SOURCE_SHA256 = '62fb69d6a9ebe720d9028af1c48aa222c7ccfabeccbd642b7f9d7758b64f4d82'
SOURCE_BYTES = 10662760
LICENSE_SHA256 = 'ee537e9553572d6f173e73dd632dc8d2e2ff2467e3118f9d7003fc1d09f9a6e5'
COMMIT = 'ba6eb2505ea3e4d05874bdf7c31a4e45003653d4'
REPOSITORY = 'https://github.com/avatarsdk/metaperson-loader-threejs'
SOURCE_URL = 'https://raw.githubusercontent.com/avatarsdk/metaperson-loader-threejs/' + COMMIT + '/public/models/sample_avatar.glb'
ROOT = Path(__file__).resolve().parent.parent
KEEP_1K = frozenset([10, 11, 19, 20])
MAX_DECODED_TEXTURE_BYTES = 64 * 1024 * 1024


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def read_regular(path, max_bytes):
    require('..' not in Path(path).parts, 'unsafe_input_path')
    path = Path(path).absolute()
    for part in [path, *path.parents]:
        require(not part.is_symlink(), 'symlink_input_forbidden')
    require(path.is_file() and 0 < path.stat().st_size <= max_bytes, 'invalid_input_file')
    return path.read_bytes()


def parse_glb(data):
    require(len(data) >= 28 and struct.unpack_from('<III', data, 0) == (0x46546C67, 2, len(data)), 'invalid_glb')
    offset = 12
    chunks = []
    while offset < len(data):
        require(offset + 8 <= len(data), 'invalid_glb')
        length, kind = struct.unpack_from('<II', data, offset)
        require(length % 4 == 0 and offset + 8 + length <= len(data), 'invalid_glb')
        chunks.append((kind, data[offset + 8:offset + 8 + length]))
        offset += 8 + length
    require(len(chunks) == 2 and chunks[0][0] == 0x4E4F534A and chunks[1][0] == 0x004E4942, 'unsupported_glb_chunks')
    document = json.loads(chunks[0][1].decode('utf-8'))
    require(document.get('asset', {}).get('version') == '2.0', 'invalid_gltf')
    require(len(document.get('buffers', [])) == 1 and 'uri' not in document['buffers'][0], 'nonlocal_buffer')
    length = document['buffers'][0]['byteLength']
    require(0 <= len(chunks[1][1]) - length <= 3, 'invalid_binary_length')
    stack = [document]
    while stack:
        value = stack.pop()
        if isinstance(value, dict):
            require(not any(key.lower() == 'uri' for key in value), 'external_uri_forbidden')
            stack.extend(value.values())
        elif isinstance(value, list):
            stack.extend(value)
    return document, chunks[1][1][:length]


def protected_document(document):
    result = copy.deepcopy(document)
    result.pop('buffers', None)
    for view in result.get('bufferViews', []):
        view.pop('byteOffset', None)
        view.pop('byteLength', None)
    return result


def canonical_hash(document):
    # Share the existing Node canonicalizer, including JS number formatting.
    code = "const fs=require('node:fs');const m=require(process.argv[1]);process.stdout.write(m.canonicalSha256(JSON.parse(fs.readFileSync(0,'utf8'))));"
    output = subprocess.run(['node', '-e', code, str(ROOT / 'scripts/lib/fullbody-asset-policy.cjs')],
        input=json.dumps(document, allow_nan=False).encode(), capture_output=True, check=True)
    value = output.stdout.decode('ascii')
    require(len(value) == 64 and all(c in '0123456789abcdef' for c in value), 'invalid_canonical_digest')
    return value


def inspect_asset(data):
    code = "const fs=require('node:fs');const m=require(process.argv[1]);const r=m.inspectAsset(fs.readFileSync(0),{filename:'sample.glb',limits:{maxMorphTargets:512,maxDecodedTextureBytes:268435456}});process.stdout.write(JSON.stringify(r));"
    output = subprocess.run(['node', '-e', code, str(ROOT / 'scripts/lib/gltf-package-inspector.cjs')],
        input=data, capture_output=True, check=True)
    return json.loads(output.stdout)


def image_roles(document):
    roles = {}
    for material in document.get('materials', []):
        def walk(value, slot=''):
            if isinstance(value, dict):
                if 'index' in value and 'texture' in slot.lower():
                    texture = document['textures'][value['index']]
                    image = texture['source']
                    roles.setdefault(image, []).append(material.get('name', '') + ':' + slot)
                for key, item in value.items():
                    walk(item, key)
            elif isinstance(value, list):
                for item in value:
                    walk(item, slot)
        walk(material)
    return roles


def resized_image(data, mime, maximum, normal_map):
    from PIL import Image
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        width, height = source.size
        require(width <= 4096 and height <= 4096 and source.format in ['PNG', 'JPEG'], 'unsupported_image')
        if max(width, height) <= maximum:
            return data, width, height, width, height, False
        scale = maximum / max(width, height)
        size = (max(1, round(width * scale)), max(1, round(height * scale)))
        image = source.convert('RGBA' if mime == 'image/png' and 'A' in source.getbands() else 'RGB')
        image = image.resize(size, Image.Resampling.LANCZOS)
        if normal_map:
            # The tangent-space vector is renormalized after filtering, before
            # encoding with the original JPEG/PNG MIME/material semantics.
            pixels = []
            normal_pixels = image.convert('RGB')
            values = getattr(normal_pixels, 'get_flattened_data', normal_pixels.getdata)()
            for pixel in values:
                vector = [channel / 127.5 - 1.0 for channel in pixel]
                length = math.sqrt(sum(v * v for v in vector))
                if length < 1e-8:
                    vector, length = [0, 0, 1], 1
                pixels.append(tuple(max(0, min(255, round((v / length + 1) * 127.5))) for v in vector))
            image = Image.new('RGB', size)
            image.putdata(pixels)
        output = io.BytesIO()
        if mime == 'image/jpeg':
            image.convert('RGB').save(output, format='JPEG', quality=95, subsampling=0, optimize=True)
        elif mime == 'image/png':
            image.save(output, format='PNG', optimize=True, compress_level=9)
        else:
            raise ValueError('unsupported_image_mime')
        return output.getvalue(), width, height, *size, True


def create_candidate(source_data, licence_data):
    require(len(source_data) == SOURCE_BYTES and sha256(source_data) == SOURCE_SHA256, 'unreviewed_source_asset')
    require(sha256(licence_data) == LICENSE_SHA256, 'unreviewed_source_licence')
    document, binary = parse_glb(source_data)
    original = copy.deepcopy(document)
    roles = image_roles(document)
    image_views = {}
    image_records = []
    for index, image in enumerate(document['images']):
        view_id = image['bufferView']
        require(view_id not in image_views, 'shared_image_view_requires_review')
        view = original['bufferViews'][view_id]
        require(view['buffer'] == 0 and 0 <= view.get('byteOffset', 0) < len(binary), 'invalid_image_view')
        start = view.get('byteOffset', 0)
        data = binary[start:start + view['byteLength']]
        require(len(data) == view['byteLength'], 'invalid_image_view')
        normal_map = any(role.endswith(':normalTexture') for role in roles.get(index, []))
        maximum = 1024 if index in KEEP_1K else 512
        changed, ow, oh, width, height, resized = resized_image(data, image['mimeType'], maximum, normal_map)
        image_views[view_id] = changed
        image_records.append({'index': index, 'mimeType': image['mimeType'], 'roles': roles.get(index, []),
            'originalWidth': ow, 'originalHeight': oh, 'width': width, 'height': height,
            'changed': resized, 'normalMap': normal_map, 'originalSha256': sha256(data), 'sha256': sha256(changed)})
    chunks = []
    offset = 0
    geometry_records = []
    for index, view in enumerate(document['bufferViews']):
        source_view = original['bufferViews'][index]
        start, length = source_view.get('byteOffset', 0), source_view['byteLength']
        require(source_view['buffer'] == 0 and 0 <= start <= len(binary) and start + length <= len(binary), 'invalid_buffer_view')
        data = image_views.get(index, binary[start:start + length])
        if index not in image_views:
            geometry_records.append({'index': index, 'bytes': len(data), 'sha256': sha256(data)})
        view['byteOffset'] = offset
        view['byteLength'] = len(data)
        chunks.append(data)
        padding = (-len(data)) % 4
        chunks.append(b'\x00' * padding)
        offset += len(data) + padding
    document['buffers'][0]['byteLength'] = offset
    protected_hash = canonical_hash(protected_document(original))
    require(protected_hash == canonical_hash(protected_document(document)), 'protected_model_json_changed')
    encoded_json = json.dumps(document, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')
    encoded_json += b' ' * ((-len(encoded_json)) % 4)
    encoded_binary = b''.join(chunks)
    total = 12 + 8 + len(encoded_json) + 8 + len(encoded_binary)
    output = (struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(encoded_json), 0x4E4F534A) + encoded_json +
        struct.pack('<II', len(encoded_binary), 0x004E4942) + encoded_binary)
    report = inspect_asset(output)
    require(report['stats']['decodedTextureBytes'] <= MAX_DECODED_TEXTURE_BYTES, 'texture_budget_exceeded')
    require(len(output) < 12 * 1024 * 1024, 'model_download_budget_exceeded')
    source_report = inspect_asset(source_data)
    for key in ['vertices', 'triangles', 'meshes', 'nodes', 'skins', 'joints', 'morphTargets', 'materials', 'images', 'geometryBytes']:
        require(report['stats'][key] == source_report['stats'][key], 'model_geometry_changed')
    from PIL import __version__ as pillow_version
    manifest = {'version': 1, 'assetId': 'natural-reference-A', 'purpose': 'licensed-static-reference-avatar',
        'model': {'path': 'sample.glb', 'bytes': len(output), 'sha256': sha256(output)},
        'license': {'id': 'BSD-3-Clause', 'notice': 'LICENSE.txt', 'url': REPOSITORY + '/blob/' + COMMIT + '/LICENSE.txt',
            'commercialUse': True, 'publicWebDelivery': True, 'copyright': 'Copyright 2024 Itseez3D, Inc. support@itseez3d.com'},
        'source': {'repository': REPOSITORY, 'url': SOURCE_URL, 'commit': COMMIT, 'sha256': SOURCE_SHA256,
            'bytes': SOURCE_BYTES, 'licenseSha256': LICENSE_SHA256, 'publisher': 'Itseez3D'},
        'derivative': {'geometryPreserved': True, 'materialsPreserved': True, 'dimensionsPreserved': True,
            'images': image_records, 'protectedJsonSha256': protected_hash, 'nonImageBufferViews': geometry_records,
            'decodedTextureBytes': report['stats']['decodedTextureBytes'], 'pillowVersion': pillow_version,
            'changes': ['All geometry, node, rig, skin, morph and material data preserved.',
                'Head base-color/normal and hair base-color/normal maps retain their exact original 1024px bytes.',
                'Other embedded maps above 512px reduced to 512px with Lanczos filtering; filtered normal maps renormalized.',
                'Original image MIME types, texture bindings and alpha semantics preserved; buffer-view offsets repacked.']},
        'inspection': {'stats': report['stats'], 'features': report['features'], 'warnings': report['warnings'],
            'blockersForOldRenderer': report['blockers'], 'runtimeProfile': report['runtimeProfile']},
        'qualityVerified': False, 'integrationApproved': False, 'actualRetailProduct': False,
        'clothPhysics': False, 'userPhotoOrMeasurements': False, 'personalReconstruction': False,
        'serviceGenerationRightsGranted': False}
    return output, manifest


def write_candidate(output_dir, model, manifest, licence):
    require('..' not in Path(output_dir).parts, 'unsafe_output_path')
    output_dir = Path(output_dir).absolute()
    for part in [output_dir, *output_dir.parents]:
        require(not part.is_symlink(), 'symlink_output_forbidden')
    output_dir.mkdir(parents=True, exist_ok=True)
    require(output_dir.is_dir(), 'invalid_output_directory')
    files = {'sample.glb': model, 'asset-manifest.json': (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'LICENSE.txt': licence}
    existing = [output_dir / name for name in files if (output_dir / name).exists()]
    if existing:
        require(len(existing) == len(files), 'incomplete_existing_output')
        for target in existing:
            require(target.is_file() and not target.is_symlink(), 'invalid_output_file')
        previous = json.loads((output_dir / 'asset-manifest.json').read_text())
        require(previous.get('assetId') == 'natural-reference-A' and
            previous.get('purpose') == 'licensed-static-reference-avatar' and
            previous.get('source', {}).get('sha256') == SOURCE_SHA256, 'unreviewed_existing_output')
        require(sha256((output_dir / 'sample.glb').read_bytes()) == previous.get('model', {}).get('sha256') and
            sha256((output_dir / 'LICENSE.txt').read_bytes()) == LICENSE_SHA256, 'modified_existing_output')
    for name, data in files.items():
        target = output_dir / name
        require(not target.is_symlink() and (not target.exists() or target.is_file()), 'invalid_output_file')
        # Explicit output only. No app edits, copying source folders or deletion.
        with tempfile.NamedTemporaryFile(prefix='a1-avatar-', dir=output_dir, delete=False) as temporary:
            temporary.write(data)
            temporary_name = temporary.name
        os.replace(temporary_name, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_glb')
    parser.add_argument('--licence', required=True)
    parser.add_argument('--output', required=True)
    options = parser.parse_args()
    try:
        source = read_regular(options.source_glb, 12 * 1024 * 1024)
        licence = read_regular(options.licence, 64 * 1024)
        model, manifest = create_candidate(source, licence)
        write_candidate(options.output, model, manifest, licence)
        print(json.dumps({'assetId': manifest['assetId'], 'model': manifest['model'],
            'decodedTextureBytes': manifest['derivative']['decodedTextureBytes'], 'qualityVerified': False}))
    except Exception as error:
        # Never print source contents, private paths or subprocess tracebacks.
        code = str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isalnum() else 'natural_avatar_conversion_failed'
        print(json.dumps({'error': code}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
