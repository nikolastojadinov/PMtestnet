// A thin wrapper around PremiumDialog to keep filename/API requested by task
import PremiumDialog from './PremiumDialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function GoPremiumModal({ open, onOpenChange }: Props) {
  return <PremiumDialog open={open} onOpenChange={onOpenChange} />;
}
