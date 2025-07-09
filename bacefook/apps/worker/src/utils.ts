import { ConnectionEvent } from "@repo/bacefook-core/types";

export function isRegisterEvent(event: any): boolean {
  return event?.type === "register" && typeof event?.name === "string";
}

export function isReferralEvent(event: any): boolean {
  return (
    event?.type === "referral" &&
    typeof event?.referredBy === "string" &&
    typeof event?.user === "string"
  );
}

export function isAddFriendEvent(event: any): boolean {
  return (
    event?.type === "addfriend" &&
    typeof event?.user1_name === "string" &&
    typeof event?.user2_name === "string"
  );
}

export function isUnfriendEvent(event: any): boolean {
  return (
    event?.type === "unfriend" &&
    typeof event?.user1_name === "string" &&
    typeof event?.user2_name === "string"
  );
}

export function isConnectionEvent(event: any): boolean {
  return (
    isRegisterEvent(event) ||
    isReferralEvent(event) ||
    isAddFriendEvent(event) ||
    isUnfriendEvent(event)
  );
}

export function parseTransaction(jsonString: string): ConnectionEvent {
  try {
    const parsed = JSON.parse(jsonString);

    if (!isConnectionEvent(parsed)) {
      throw new Error(`Invalid transaction format: ${jsonString}`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse transaction: ${error}`);
  }
}
