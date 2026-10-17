import { useState, type FormEvent } from 'react';
import { isAdminPasswordValid } from '../utils/verificationCode';

interface VerificationCodePageProps {
  onVerified: () => void;
  onBack: () => void;
}

export default function VerificationCodePage({
  onVerified,
  onBack,
}: VerificationCodePageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdminPasswordValid(password)) {
      setError(true);
      return;
    }
    onVerified();
  };

  return (
    <section className="settings-section verification-page">
      <h2>管理者タブ</h2>
      <p>管理者パスワードを入力してください。</p>
      <form className="verification-form" onSubmit={handleSubmit}>
        <label htmlFor="admin-password">パスワード</label>
        <input
          id="admin-password"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? 'verification-error' : undefined}
        />
        {error && (
          <p className="error-message" id="verification-error" role="alert">
            パスワードが正しくありません。
          </p>
        )}
        <div className="action-buttons">
          <button className="primary-button" type="submit">
            確認する
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>
            ホームに戻る
          </button>
        </div>
      </form>
    </section>
  );
}
