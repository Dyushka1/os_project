import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ClientRegister() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/client", { replace: true });
  }, [navigate]);

  return null;
}
