import { LegalPage } from '@/components/LegalPage';
import { terms } from '@/legal/content';

export default function Terms() {
  return <LegalPage doc={terms} />;
}
