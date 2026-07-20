use soroban_sdk::{contracttype, Address};

/// A time-locked gift record stored on-chain.
#[contracttype]
pub struct Gift {
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub unlock_time: u64,
    pub is_claimed: bool,
}

/// Storage keys for the gift contract's instance storage.
#[contracttype]
pub enum DataKey {
    /// The privileged admin address, set once at initialization.
    Admin,
    /// Sequential counter for generating unique gift IDs.
    GiftCounter,
    /// Persistent record for a specific gift ID.
    GiftRecord(u64),
    /// The USDC token contract address used by the contract.
    TokenAddress,
}
