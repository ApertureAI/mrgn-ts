import { Button } from "~/components/ui/button";
import { IconLoader } from "~/components/ui/icons";

type WalletAuthButtonProps = {
  name: string;
  image: React.ReactNode;
  loading: boolean;
  active: boolean;
  onClick: () => void;
};

export const WalletAuthButton = ({ name, image, loading, active, onClick }: WalletAuthButtonProps) => {
  return (
    <Button onClick={() => onClick()} variant="secondary" size="icon" disabled={!active} className="w-14 h-14">
      {loading && <IconLoader />}
      {!loading && image}
    </Button>
  );
};
