import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import tw from "~/styles/tailwind";
import { PoolCardStats } from "./PoolCardStats";
import { PoolCardActions } from "./PoolCardActions";
import { MarginfiAccountWrapper, MarginfiClient } from "@mrgnlabs/marginfi-client-v2";
import { PoolCardPosition } from "./PoolCardPosition";
import { useConnection } from "~/hooks/useConnection";
import { ActionType, Emissions, ExtendedBankInfo, FEE_MARGIN, isActiveBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import { getCurrentAction, showErrorToast } from "~/utils";
import { percentFormatter, usdFormatter } from "@mrgnlabs/mrgn-common";

type Props = {
  bankInfo: ExtendedBankInfo;
  nativeSolBalance: number;
  isInLendingMode: boolean;
  marginfiClient: MarginfiClient | null;
  marginfiAccount: MarginfiAccountWrapper | null;
  reloadBanks: () => Promise<void>;
};

export function PoolCard({
  bankInfo,
  isInLendingMode,
  nativeSolBalance,
  marginfiAccount,
  marginfiClient,
  reloadBanks,
}: Props) {
  const rateAP = useMemo(
    () =>
      percentFormatter.format(
        (isInLendingMode ? bankInfo.lendingRate : bankInfo.borrowingRate) +
          (isInLendingMode && bankInfo.emissions == Emissions.Lending ? bankInfo.emissionsRate : 0) +
          (!isInLendingMode && bankInfo.emissions == Emissions.Borrowing ? bankInfo.emissionsRate : 0)
      ),
    [isInLendingMode, bankInfo]
  );

  const currentAction = useMemo(() => getCurrentAction(isInLendingMode, bankInfo), [isInLendingMode, bankInfo]);

  const depositFilled = useMemo(() => bankInfo.totalPoolDeposits / bankInfo.bank.config.depositLimit, [bankInfo]);
  const borrowFilled = useMemo(() => bankInfo.totalPoolBorrows / bankInfo.bank.config.borrowLimit, [bankInfo]);

  const connection = useConnection();

  const borrowOrLend = useCallback(
    async (amount: string) => {
      const borrowOrLendAmount = Number.parseFloat(amount);

      if (Number.isNaN(borrowOrLendAmount) || borrowOrLendAmount <= 0) {
        return;
      }

      if (!connection) throw Error("No connection found");

      if (marginfiClient === null) throw Error("Marginfi client not ready");

      if (currentAction === ActionType.Deposit && bankInfo.maxDeposit === 0) {
        showErrorToast(`You don't have any ${bankInfo.tokenSymbol} to lend in your wallet.`);
        return;
      }

      if (currentAction === ActionType.Borrow && bankInfo.maxBorrow === 0) {
        showErrorToast(`You cannot borrow any ${bankInfo.tokenSymbol} right now.`);
        return;
      }

      let _marginfiAccount = marginfiAccount;

      if (nativeSolBalance < FEE_MARGIN) {
        showErrorToast("Not enough sol for fee.");
        return;
      }

      // -------- Create marginfi account if needed
      try {
        if (_marginfiAccount === null) {
          if (currentAction !== ActionType.Deposit) {
            showErrorToast("An account is required for anything operation except deposit.");
            return;
          }
          // Creating account

          _marginfiAccount = await marginfiClient.createMarginfiAccount();
        }
      } catch (error: any) {
        console.log(`Error while ${currentAction + "ing"}`);
        console.log(error);
        return;
      }

      // -------- Perform relevant operation
      try {
        if (currentAction === ActionType.Deposit) {
          await _marginfiAccount.deposit(borrowOrLendAmount, bankInfo.bank.address);
        }

        if (_marginfiAccount === null) {
          // noinspection ExceptionCaughtLocallyJS
          throw Error("Marginfi account not ready");
        }

        if (currentAction === ActionType.Borrow) {
          await _marginfiAccount.borrow(borrowOrLendAmount, bankInfo.bank.address);
        } else if (currentAction === ActionType.Repay) {
          const repayAll = isActiveBankInfo(bankInfo) ? borrowOrLendAmount === bankInfo.position.amount : false;
          await _marginfiAccount.repay(borrowOrLendAmount, bankInfo.bank.address, repayAll);
        } else if (currentAction === ActionType.Withdraw) {
          const withdrawAll = isActiveBankInfo(bankInfo) ? borrowOrLendAmount === bankInfo.position.amount : false;
          await _marginfiAccount.withdraw(borrowOrLendAmount, bankInfo.bank.address, withdrawAll);
        }
      } catch (error: any) {
        console.log(`Error while ${currentAction + "ing"}`);
        console.log(error);
      }

      // TODO: set values back to 0
      try {
        await reloadBanks();
      } catch (error: any) {
        console.log("Error while reloading state");
        console.log(error);
      }
    },
    [bankInfo, connection, currentAction, marginfiAccount, marginfiClient, nativeSolBalance, reloadBanks]
  );

  return (
    <View style={tw`bg-[#1C2125] rounded-xl px-12px py-16px flex flex-column gap-16px `}>
      <View style={tw`flex flex-row justify-between`}>
        <View style={tw`flex flex-row gap-7px`}>
          <Image style={styles.logo} source={{ uri: bankInfo.tokenIcon }} alt={bankInfo.tokenSymbol} />
          <View style={tw`flex flex-column`}>
            <Text style={tw`text-primary text-base`}>{bankInfo.tokenSymbol}</Text>
            <Text style={tw`text-tertiary`}>{usdFormatter.format(bankInfo.tokenPrice)}</Text>
          </View>
        </View>
        <View>
          <Text style={tw`text-${isInLendingMode ? "success" : "error"} text-base my-auto`}>
            {rateAP.concat(...[" ", isInLendingMode ? "APY" : "APR"])}
          </Text>
        </View>
      </View>
      <PoolCardStats
        bankInfo={bankInfo}
        bankFilled={isInLendingMode ? depositFilled : borrowFilled}
        nativeSolBalance={nativeSolBalance}
        isInLendingMode={isInLendingMode}
      />
      {bankInfo?.hasActivePosition && <PoolCardPosition bankInfo={bankInfo} />}
      <PoolCardActions
        currentAction={currentAction}
        isBankFilled={isInLendingMode ? depositFilled >= 0.9999 : borrowFilled >= 0.9999}
        bankInfo={bankInfo}
        onAction={(amount) => borrowOrLend(amount)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 40,
    height: 40,
  },
});
