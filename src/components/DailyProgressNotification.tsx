/**
 * 家庭教師継続条件の通知コンポーネント
 * 今日の回答数を常時表示する
 */

import { useCallback, useEffect, useState } from 'react';
import { getAllAnswerRecords } from '../storage/db';
import { countTodayAnswers, DAILY_GOAL, ANSWER_RECORDED_EVENT } from '../utils/dailyCount';

export default function DailyProgressNotification() {
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const records = await getAllAnswerRecords();
      setTodayCount(countTodayAnswers(records));
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  // 初期ロードと回答記録イベントでカウントを更新
  useEffect(() => {
    void refresh();

    // 回答が送信されたらカウントを更新
    const handleAnswerRecorded = () => {
      void refresh();
    };
    window.addEventListener(ANSWER_RECORDED_EVENT, handleAnswerRecorded);

    return () => {
      window.removeEventListener(ANSWER_RECORDED_EVENT, handleAnswerRecorded);
    };
  }, [refresh]);

  // 日付が変わったらカウントをリセット
  useEffect(() => {
    // 1分ごとに日付変更をチェック
    const interval = setInterval(() => {
      void refresh();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return null;
  }

  const remaining = Math.max(0, DAILY_GOAL - todayCount);
  const achieved = todayCount >= DAILY_GOAL;

  return (
    <div className={`daily-progress ${achieved ? 'achieved' : ''}`}>
      <div className="daily-progress-title">家庭教師継続条件</div>
      {achieved ? (
        <div className="daily-progress-message">本日の1000問を達成しました。</div>
      ) : (
        <>
          <div className="daily-progress-message">
            今日1000問以上解かないと家庭教師をやめます。
          </div>
          <div className="daily-progress-stats">
            <span>現在：{todayCount} / {DAILY_GOAL}問</span>
            <span>残り：{remaining}問</span>
          </div>
        </>
      )}
    </div>
  );
}