import { LegalPage } from "../components/LegalPage";
import raw from "../../docs/legal/delete-account.md?raw";

// Public page that explains how to delete an account. Google Play asks for
// one that works without installing the app.
export function DeleteAccountInfo() {
  return <LegalPage raw={raw} />;
}
