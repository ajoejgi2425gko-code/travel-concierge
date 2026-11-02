const form = document.getElementById('tripForm');
const $ = (id) => document.getElementById(id);
const value = (id) => $(id).value.trim();
const checked = (id) => [...document.querySelectorAll(`#${id} input:checked`)].map(x => x.value);
const clean = (v) => v && v.trim() ? v.trim() : '指定なし';

const startDateInput = $('startDate');
const endDateInput = $('endDate');
const durationSelect = $('duration');
const dateHelp = $('dateHelp');

function updateDurationFromDates() {
  const start = startDateInput.value;
  const end = endDateInput.value;

  // 帰着日は出発日より前に設定できないようにする
  endDateInput.min = start || '';
  if (start && end && end < start) {
    endDateInput.value = '';
  }

  if (startDateInput.value && endDateInput.value) {
    const [sy, sm, sd] = startDateInput.value.split('-').map(Number);
    const [ey, em, ed] = endDateInput.value.split('-').map(Number);
    const startUtc = Date.UTC(sy, sm - 1, sd);
    const endUtc = Date.UTC(ey, em - 1, ed);
    const nights = Math.round((endUtc - startUtc) / 86400000);
    const calculated = nights === 0 ? '日帰り'
      : nights === 1 ? '1泊2日'
      : nights === 2 ? '2泊3日'
      : nights === 3 ? '3泊4日'
      : '4泊以上';
    durationSelect.value = calculated;
    durationSelect.disabled = true;
    dateHelp.textContent = `選択した日付から「${calculated}」と自動計算しました。日付を消すと、日程を自由に選べます。`;
  } else {
    if (durationSelect.disabled) durationSelect.value = '未定・提案してほしい';
    durationSelect.disabled = false;
    dateHelp.textContent = '日付を両方選ぶと泊数を自動計算します。日程が未定なら、日付は空欄のままで大丈夫です。';
  }
}

startDateInput.addEventListener('change', updateDurationFromDates);
endDateInput.addEventListener('change', updateDurationFromDates);

function buildPrompt() {
  const destination = clean(value('destination'));
  const startDate = value('startDate');
  const endDate = value('endDate');
  const dates = startDate && endDate ? `${startDate} ～ ${endDate}`
    : startDate ? `出発日：${startDate}（帰着日は未定）`
    : endDate ? `帰着日：${endDate}（出発日は未定）`
    : '未定';
  const styles = checked('styles');
  const interests = checked('interests');
  const lines = [
`あなたは、旅行計画の立案に精通した経験豊富な旅行コンシェルジュです。以下の条件をもとに、実行しやすく満足度の高い旅行プランを日本語で提案してください。`,
'',
'【旅行の条件】',
`・旅行先の範囲：${value('area')}`,
`・希望する旅行先：${destination}`,
`・出発地：${clean(value('departure'))}`,
`・日程：${value('duration')}`,
`・出発日・帰着日：${dates}`,
`・旅行スタイル：${styles.length ? styles.join('、') : '指定なし'}`,
`・人数：大人${value('adults')}人、子ども${value('children')}`,
`・子どもの年齢：${clean(value('ages'))}`,
`・予算：${value('budget')}（${value('budgetBasis')}）`,
`・主な移動手段：${value('transport')}`,
`・宿泊の希望：${value('stay')}`,
`・宿泊施設の条件：${clean(value('stayWish'))}`,
`・食事の希望：${clean(value('food'))}`,
`・興味・関心：${interests.length ? interests.join('、') : '指定なし'}`,
`・旅行のペース：${value('pace')}`,
`・避けたいこと・配慮事項：${clean(value('avoid'))}`,
`・その他の希望：${clean(value('extra'))}`,
'',
'【調査・提案に関するお願い】',
`・${value('research')}。`,
'・行き先が未定の場合は、条件に合う旅行先を複数提案し、それぞれのメリット・注意点を比較してください。',
'・予算は交通費、宿泊費、食費、入場料などに分け、概算の根拠と、料金に含まれないものを示してください。',
'・移動時間や乗換、施設間の距離を考慮し、無理のない現実的な行程にしてください。',
'・子どもや高齢者がいる場合は、休憩、食事、トイレ、移動負担にも配慮してください。',
'・営業時間、休館日、料金、交通ダイヤ、営業状況など、変わりやすい情報は確認日と情報源を示してください。確認できない情報は推測で断定せず「要確認」としてください。',
'・ホテルや飲食店、観光施設は、実在する候補を挙げ、公式サイトなど確認できるリンクを付けてください。予約可能・空室ありとは、確認できた場合以外は断定しないでください。',
'・条件に矛盾や不足があっても、まず合理的な仮定を明記して案を作り、最後に必要な確認事項をまとめてください。',
'',
'【回答してほしい内容】',
'1. 旅行全体のコンセプトと、このプランがおすすめである理由',
'2. 日程ごとの詳しいスケジュール（時刻、場所、滞在目安、移動方法）',
'3. 宿泊施設の候補と比較（立地、特徴、概算料金、公式サイト）',
'4. 食事場所・名物グルメの候補',
'5. 旅行全体と項目別の予算目安',
'6. 雨天時・予定変更時の代替案',
'7. 予約や事前準備が必要なこと、注意点',
'8. 参照した情報源と、最新情報として確認できなかった項目',
'',
`回答の詳しさ：${value('detail')}。`,
'見やすい見出し、表、箇条書きを使い、旅行当日にそのまま参考にできる具体性を重視してください。'
  ];
  return lines.join('\n');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  $('promptOutput').value = buildPrompt();
  $('result').classList.remove('hidden');
  $('copyStatus').textContent = '';
  $('result').scrollIntoView({behavior: 'smooth', block: 'start'});
});

$('copyButton').addEventListener('click', async () => {
  const text = $('promptOutput').value;
  try {
    await navigator.clipboard.writeText(text);
    $('copyStatus').textContent = 'コピーしました。ChatGPTなどの入力欄に貼り付けてください。';
  } catch {
    $('promptOutput').focus();
    $('promptOutput').select();
    const ok = document.execCommand('copy');
    $('copyStatus').textContent = ok ? 'コピーしました。' : '文章を選択しました。コピーしてください。';
  }
});

$('shareButton').addEventListener('click', async () => {
  const text = $('promptOutput').value;
  if (navigator.share) {
    try { await navigator.share({title: '旅行プラン作成プロンプト', text}); }
    catch (err) { if (err.name !== 'AbortError') $('copyStatus').textContent = '共有できませんでした。コピー機能をご利用ください。'; }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      $('copyStatus').textContent = 'この端末では共有機能に対応していないため、文章をコピーしました。';
    } catch {
      $('copyStatus').textContent = 'コピー機能をご利用ください。';
    }
  }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
