use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    GiftNotFound = 4,
    TimeLockNotExpired = 5,
    AlreadyClaimed = 6,
    AmountTooSmall = 7,
    InsufficientBalance = 8,
}
