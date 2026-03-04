import Modal from './Modal';
import { useEffect, useState } from 'react';

export default function ConfirmPasswordModal({
  open,
  title = 'Confirmar senha',
  confirmLabel = 'Confirmar',
  danger = false,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className={danger ? 'btn danger' : 'btn primary'}
            type="button"
            onClick={() => onConfirm(password)}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Digite sua senha para continuar</div>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
        />
      </div>
    </Modal>
  );
}

