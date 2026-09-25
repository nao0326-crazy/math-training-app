/** 一時的な公開停止中に表示する画面 */
export default function MaintenancePage() {
  return (
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <section className="maintenance-card" role="status" aria-live="polite">
        <div className="maintenance-mark" aria-hidden="true">
          ⏸
        </div>
        <h1 id="maintenance-title">小6数学トレーニング</h1>
        <h2>現在、このアプリは一時的に公開を停止しています。</h2>
        <p>しばらくお待ちください。</p>
      </section>
    </main>
  );
}
