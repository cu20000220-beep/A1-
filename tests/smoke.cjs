/* Run with an installed Playwright module and Chromium. No production dependency. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.A1_TEST_URL||'http://127.0.0.1:8000/';
 await page.goto(base);assert.equal(await page.title(),'A1 FASHION — Everyday, elevated.');
 const count=async n=>assert.equal(await page.locator('.card').count(),n);
 await count(12);
 for(const [gender,n] of [['여성',5],['남성',3],['유니섹스',4]]){await page.locator(`.gender-tabs [data-gender="${gender}"]`).click();await count(n)}
 await page.locator('#reset').click();await page.locator('#category').selectOption('아우터');await count(4);
 await page.locator('#price').selectOption('over100');await count(4);
 await page.locator('#style').selectOption('클래식');await count(2);
 await page.locator('#reset').click();await page.locator('#price').selectOption('under50');await count(3);
 await page.locator('#reset').click();await page.locator('#search').fill('데님');await count(3);
 await page.locator('#sort').selectOption('low');assert.match(await page.locator('.card .price').first().innerText(),/39,000/);
 await page.locator('#search').fill('<img src=x>');await count(0);assert.ok(await page.locator('#empty').isVisible());
 await page.locator('#empty-reset').click();await count(12);
 await page.locator('[data-wish="a1-001"]').click();assert.equal(await page.locator('#wish-count').innerText(),'1');
 await page.reload();assert.equal(await page.locator('#wish-count').innerText(),'1');
 await page.locator('#wish-nav').click();await count(1);await page.locator('[data-wish="a1-001"]').click();await count(0);
 await page.locator('#empty-reset').click();await page.locator('[data-detail="a1-002"]').first().click();
 assert.ok(await page.locator('#detail').isVisible());assert.equal(await page.locator('#detail-title').innerText(),'모던 시티 셋업');
 await page.locator('[data-detail-wish]').click();assert.equal(await page.locator('[data-detail-wish]').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Escape');assert.ok(!(await page.locator('#detail').isVisible()));
 await page.locator('[data-detail="a1-002"]').first().click();await page.locator('[data-look]').click();assert.equal(await page.locator('#look-select').inputValue(),'2');assert.ok(!(await page.locator('#detail').isVisible()));
 await page.locator('#look-select').selectOption('1');assert.match(await page.locator('#look-note').innerText(),/편안한 기본/);
 for(const [width,height] of [[1440,1000],[820,1180],[390,844],[320,740]]){await page.setViewportSize({width,height});await page.locator('#reset').click();await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow: ${width}`);await page.screenshot({path:`/tmp/a1-${width}.png`,fullPage:true});await page.locator('[data-detail="a1-001"]').first().click();assert.ok(await page.locator('#close-detail').isVisible());await page.locator('#close-detail').click();for(let look=0;look<3;look++){await page.locator('#look-select').selectOption(String(look));await page.locator('#look-image').evaluate(i=>i.decode());const removed=await page.locator('#look-image').evaluate(img=>{const box=img.getBoundingClientRect(),clip=img.parentElement.getBoundingClientRect();const scale=Math.max(box.width/img.naturalWidth,box.height/img.naturalHeight);return ((clip.top-box.top)+(img.naturalHeight*scale-box.height))/(scale*img.naturalHeight)});assert.ok(removed>=[.31,.43,.26][look],`face crop: ${width}, ${look}`)}}
 await page.route('**/assets/photos/man.jpg',route=>route.abort());await page.reload();await page.locator('#search').fill('모던');await page.waitForFunction(()=>{const i=document.querySelector('.card img');return i?.dataset.fallback==='true'&&i.complete&&i.naturalWidth>0});await page.unroute('**/assets/photos/man.jpg');
 assert.deepEqual(errors,[]);console.log('PASS: gender/category/price/style filters, search, sort, empty state, wishlist persistence/removal, product modal, Escape, style reference, 1440/820/390/320px layouts, image fallback, no JS errors.');
 if(process.env.A1_CHECK_PHOTOS==='1'){await page.goto(base);await page.locator('footer').scrollIntoViewIfNeeded();await page.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager')});await page.waitForFunction(()=>[...document.images].every(i=>i.complete));assert.equal(await page.locator('.image-fallback').count(),0);assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth>0)));console.log('PASS: all real photos loaded without fallback.')}
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
