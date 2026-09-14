import { LegalPage } from "../components/LegalPage";
import raw from "../../docs/legal/privacy-policy.md?raw";

export function PrivacyPolicy() {
  return <LegalPage raw={raw} />;
}
