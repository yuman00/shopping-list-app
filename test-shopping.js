const { chromium } = require('playwright');

const SUPABASE_URL = 'https://cerpsfcbtqjqzbysvbch.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gzI3oypELfOw0zcZsVuycA__RG3bxkk';
const BASE_URL = 'http://localhost:8765/shopping-list.html';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function clearDB() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shopping_items?id=gte.0`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('DB 초기화 실패:', res.status, await res.text());
  }
}

async function resetAndReload(page) {
  await clearDB();
  await page.reload();
  await page.waitForSelector('#loading', { state: 'hidden' });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(BASE_URL);
  await page.waitForSelector('#loading', { state: 'hidden' });
  await clearDB();
  await page.reload();
  await page.waitForSelector('#loading', { state: 'hidden' });

  // ─────────────────────────────────────────────
  // 1. 초기 상태 테스트
  // ─────────────────────────────────────────────
  console.log('\n📋 [1] 초기 상태 테스트');

  const emptyMsg = await page.locator('#empty').isVisible();
  assert(emptyMsg, '빈 상태 메시지가 표시됨');

  const summaryText = await page.locator('#summary').textContent();
  assert(summaryText.trim() === '', '요약 텍스트가 비어있음');

  const clearBtnVisible = await page.locator('#clear-btn').isVisible();
  assert(!clearBtnVisible, '"완료된 항목 삭제" 버튼이 숨겨져 있음');

  // ─────────────────────────────────────────────
  // 2. 아이템 추가 테스트
  // ─────────────────────────────────────────────
  console.log('\n➕ [2] 아이템 추가 테스트');

  await page.fill('#item-input', '사과');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(500);
  let items = await page.locator('#list li').count();
  assert(items === 1, '아이템 1개 추가됨 (버튼 클릭)');

  await page.fill('#item-input', '바나나');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  items = await page.locator('#list li').count();
  assert(items === 2, '아이템 2개 추가됨 (Enter 키)');

  await page.fill('#item-input', '우유');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  items = await page.locator('#list li').count();
  assert(items === 3, '아이템 3개 추가됨');

  await page.fill('#item-input', '   ');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(300);
  items = await page.locator('#list li').count();
  assert(items === 3, '공백만 입력하면 추가 안 됨');

  await page.fill('#item-input', '계란');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(500);
  const inputVal = await page.inputValue('#item-input');
  assert(inputVal === '', '추가 후 입력창이 비워짐');
  items = await page.locator('#list li').count();
  assert(items === 4, '아이템 4개로 늘어남');

  const emptyHidden = await page.locator('#empty').isHidden();
  assert(emptyHidden, '아이템 추가 후 빈 상태 메시지가 사라짐');

  const summary = await page.locator('#summary').textContent();
  assert(summary.includes('4'), '요약에 총 아이템 수(4)가 표시됨');
  assert(summary.includes('0'), '요약에 완료 개수(0)가 표시됨');

  // ─────────────────────────────────────────────
  // 3. 체크(완료) 기능 테스트
  // ─────────────────────────────────────────────
  console.log('\n☑️  [3] 체크 기능 테스트');

  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();
  await page.waitForTimeout(500);
  const firstChecked = await page.locator('#list li').nth(0).getAttribute('class');
  assert(firstChecked && firstChecked.includes('checked'), '첫 번째 아이템이 checked 클래스 추가됨');

  const strikethrough = await page.locator('#list li').nth(0).locator('.item-text').evaluate(el => {
    return getComputedStyle(el).textDecorationLine;
  });
  assert(strikethrough.includes('line-through'), '완료된 아이템에 취소선 적용됨');

  const summaryAfterCheck = await page.locator('#summary').textContent();
  assert(summaryAfterCheck.includes('완료 1'), '체크 후 요약에 완료 1개 표시됨');

  const clearBtnNowVisible = await page.locator('#clear-btn').isVisible();
  assert(clearBtnNowVisible, '체크된 항목 있으면 "완료된 항목 삭제" 버튼 표시됨');

  await page.locator('#list li').nth(1).locator('input[type="checkbox"]').click();
  await page.waitForTimeout(500);
  const summaryAfterCheck2 = await page.locator('#summary').textContent();
  assert(summaryAfterCheck2.includes('완료 2'), '2개 체크 후 요약에 완료 2개 표시됨');

  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();
  await page.waitForTimeout(500);
  const firstUnchecked = await page.locator('#list li').nth(0).getAttribute('class');
  assert(!firstUnchecked || !firstUnchecked.includes('checked'), '체크 해제 후 checked 클래스 제거됨');
  const summaryAfterUncheck = await page.locator('#summary').textContent();
  assert(summaryAfterUncheck.includes('완료 1'), '체크 해제 후 요약이 완료 1개로 업데이트됨');

  // ─────────────────────────────────────────────
  // 4. 아이템 삭제 테스트
  // ─────────────────────────────────────────────
  console.log('\n🗑️  [4] 아이템 삭제 테스트');

  let beforeDelete = await page.locator('#list li').count();
  assert(beforeDelete === 4, '삭제 전 아이템 4개');

  await page.locator('#list li').nth(3).locator('.delete-btn').click();
  await page.waitForTimeout(500);
  let afterDelete = await page.locator('#list li').count();
  assert(afterDelete === 3, '삭제 후 아이템 3개로 줄어듦');

  await page.locator('#list li').nth(0).locator('.delete-btn').click();
  await page.waitForTimeout(500);
  afterDelete = await page.locator('#list li').count();
  assert(afterDelete === 2, '두 번째 삭제 후 아이템 2개로 줄어듦');

  const summaryAfterDelete = await page.locator('#summary').textContent();
  assert(summaryAfterDelete.includes('2'), '삭제 후 요약에 총 2개 표시됨');

  // ─────────────────────────────────────────────
  // 5. "완료된 항목 삭제" 테스트
  // ─────────────────────────────────────────────
  console.log('\n🧹 [5] 완료된 항목 일괄 삭제 테스트');

  const remainingItems = await page.locator('#list li .item-text').allTextContents();
  console.log(`     현재 아이템: ${remainingItems.join(', ')}`);

  const countBefore = await page.locator('#list li').count();
  const checkedBefore = await page.locator('#list li.checked').count();
  console.log(`     총 ${countBefore}개 중 완료 ${checkedBefore}개`);

  assert(checkedBefore >= 1, '"완료된 항목 삭제" 테스트 전 체크된 항목 있음');

  await page.locator('#clear-btn').click();
  await page.waitForTimeout(500);
  const afterClear = await page.locator('#list li').count();
  assert(afterClear === countBefore - checkedBefore, `완료 항목 ${checkedBefore}개 일괄 삭제됨`);

  const checkedAfter = await page.locator('#list li.checked').count();
  assert(checkedAfter === 0, '삭제 후 체크된 항목이 없음');

  // ─────────────────────────────────────────────
  // 6. 모든 아이템 삭제 후 빈 상태 복귀 테스트
  // ─────────────────────────────────────────────
  console.log('\n🔄 [6] 모든 아이템 삭제 후 초기 상태 복귀 테스트');

  while (await page.locator('#list li').count() > 0) {
    await page.locator('#list li').nth(0).locator('.delete-btn').click();
    await page.waitForTimeout(400);
  }

  const emptyAgain = await page.locator('#empty').isVisible();
  assert(emptyAgain, '모든 아이템 삭제 후 빈 상태 메시지 다시 표시됨');

  const clearBtnHidden = await page.locator('#clear-btn').isVisible();
  assert(!clearBtnHidden, '모든 아이템 삭제 후 "완료된 항목 삭제" 버튼 숨겨짐');

  const summaryEmpty = await page.locator('#summary').textContent();
  assert(summaryEmpty.trim() === '', '모든 아이템 삭제 후 요약 텍스트 비워짐');

  // ─────────────────────────────────────────────
  // 7. DB 저장/복원 테스트 (페이지 새로고침 후 데이터 유지)
  // ─────────────────────────────────────────────
  console.log('\n💾 [7] DB 저장/복원 테스트');

  await page.fill('#item-input', '저장 테스트');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();
  await page.waitForTimeout(500);

  await page.reload();
  await page.waitForSelector('#loading', { state: 'hidden' });

  const restoredItems = await page.locator('#list li').count();
  assert(restoredItems === 1, '새로고침 후 DB에서 아이템 복원됨');

  const restoredChecked = await page.locator('#list li.checked').count();
  assert(restoredChecked === 1, '새로고침 후 체크 상태도 복원됨');

  // ─────────────────────────────────────────────
  // 8. XSS 방어 테스트
  // ─────────────────────────────────────────────
  console.log('\n🔒 [8] XSS 방어 테스트');

  await resetAndReload(page);
  await page.fill('#item-input', '<script>alert("XSS")</script>');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(500);

  const xssItemText = await page.locator('#list li .item-text').textContent();
  assert(xssItemText.includes('<script>'), 'XSS 스크립트가 텍스트로 이스케이프됨');

  const xssAlert = await page.evaluate(() => {
    const el = document.querySelector('#list li .item-text');
    return el ? el.innerHTML : '';
  });
  assert(xssAlert.includes('&lt;script&gt;'), 'HTML 특수문자가 올바르게 이스케이프됨');

  // ─────────────────────────────────────────────
  // 결과 출력
  // ─────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`📊 테스트 결과: 총 ${passed + failed}개`);
  console.log(`   ✅ 통과: ${passed}개`);
  console.log(`   ❌ 실패: ${failed}개`);
  if (failed === 0) {
    console.log('\n🎉 모든 테스트 통과!');
  } else {
    console.log('\n⚠️  일부 테스트 실패. 위 항목을 확인하세요.');
  }
  console.log('='.repeat(50));

  await clearDB();
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
