import React, { createContext, FC, useCallback, useContext, useEffect, useState } from "react";
import { MarginfiClient } from "@mrgnlabs/marginfi-client-v2";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import config from "~/config";
import { LipClient } from "@mrgnlabs/lip-client";

// @ts-ignore - Safe because context hook checks for null
const ProgramContext = createContext<ProgramState>();

interface ProgramState {
  mfiClient: MarginfiClient | null;
  lipClient: LipClient | null;
  reload: () => Promise<void>;
}

const ProgramProvider: FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [mfiClient, setMfiClient] = useState<MarginfiClient | null>(null);
  const [lipClient, setLipClient] = useState<LipClient | null>(null);

  useEffect(() => {
    (async function () {
      const client = await MarginfiClient.fetch(
        config.mfiConfig,
        anchorWallet ?? {} as any,
        connection
      );
      const lipClient = await LipClient.fetch(
        config.lipConfig,
        anchorWallet ?? {} as any,
        connection,
        client
      );
      setMfiClient(client);
      setLipClient(lipClient);
    })();
  }, [anchorWallet, connection]);

  const reload = useCallback(async () => {
    if (!lipClient) return;
    await lipClient.reload();
    setLipClient(lipClient);
  }, [lipClient]);

  return (
    <ProgramContext.Provider
      value={{
        mfiClient,
        lipClient,
        reload,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
};

const useProgram = () => {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error("useProgramState must be used within a ProgramStateProvider");
  }

  return context;
};

export { useProgram, ProgramProvider };
