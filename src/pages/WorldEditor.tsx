import { useNavigate } from "react-router-dom";
import WorldEditorTab from "../components/worldEditor/WorldEditorTab";

export default function WorldEditor() {
  const navigate = useNavigate();
  return <WorldEditorTab onBack={() => navigate("/")} />;
}
