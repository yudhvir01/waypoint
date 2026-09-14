import { LegalPage } from "../components/LegalPage";
import raw from "../../docs/legal/terms-of-service.md?raw";

export function TermsOfService() {
  return <LegalPage raw={raw} />;
}
