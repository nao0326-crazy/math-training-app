import { useState } from 'react';
import { verifyAdminPassword } from '../utils/adminMode';

interface AdminGateDialogProps {
  /** 認証結果 (true なら管理者モードを解除した) */
  onResolved: (unlocked: boolean) => void;
  /** ダイアログを閉じる */
  onClose: () => void;
}

/**
 * 管理者モードのパスワード入力ダイアログ
 *
 * ユーザーからは隠した入口からのみ開く。入力値は文字列として照合する。
 */
export default function AdminGateDialog({ onResolved, onClose }: AdminGateDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (verifyAdminPassword(password)) {
      onResolved(true);
      return;
    }
    setError('パスワードが違います');
    setPassword('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="管理者モード"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">管理者モード</div>
        <input
          className="admin-gate-input"
          type="password"
          value={password}
          placeholder="パスワード"
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        {error && <p className="admin-gate-error">{error}</p>}
        <div className="modal-buttons">
          <button type="button" className="primary-button" onClick={handleSubmit}>
            解除する
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}
