import { useState } from "react";
import { Button, Input, Modal, Space, Typography, message } from "antd";

const { Text } = Typography;

type TypedDangerButtonProps = {
  buttonText: string;
  title: string;
  description?: string;
  confirmWord?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
};

export default function TypedDangerButton({
  buttonText,
  title,
  description,
  confirmWord = "DELETE",
  onConfirm,
  disabled,
}: TypedDangerButtonProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const closeModal = () => {
    setOpen(false);
    setValue("");
  };

  const handleConfirm = async () => {
    if (value.trim() !== confirmWord) {
      message.error(`Введите ${confirmWord} для подтверждения`);
      return;
    }
    try {
      setLoading(true);
      await onConfirm();
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button danger disabled={disabled} onClick={() => setOpen(true)}>
        {buttonText}
      </Button>
      <Modal
        title={title}
        open={open}
        onCancel={closeModal}
        onOk={handleConfirm}
        okText="Подтвердить"
        cancelText="Отмена"
        okButtonProps={{ danger: true, loading }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {description ? <Text>{description}</Text> : null}
          <Text type="secondary">Для подтверждения введите: {confirmWord}</Text>
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={confirmWord}
            autoFocus
          />
        </Space>
      </Modal>
    </>
  );
}
