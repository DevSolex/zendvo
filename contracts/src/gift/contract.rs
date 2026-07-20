use soroban_sdk::{contract, contractimpl, Address, Env};

use crate::gift::events;
use crate::gift::storage;
use crate::gift::types::DataKey;

/// Entry point for the time-locked gift contract.
#[contract]
pub struct GiftContract;

#[contractimpl]
impl GiftContract {
    /// Initializes the contract with a backend admin address.
    ///
    /// Must be called exactly once immediately after deployment.
    /// Reverts if the admin has already been set, preventing any actor
    /// from overwriting admin rights post-deployment.
    pub fn initialize(env: Env, admin: Address) {
        // Guard: panic if already initialized to prevent admin hijacking.
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Allows the sender to redirect a pending (unclaimed) gift to a new
    /// recipient address. This is useful when the original recipient has lost
    /// access to their Stellar wallet.
    ///
    /// # Panics
    /// - If the caller is not the original `sender`.
    /// - If the gift has already been claimed.
    pub fn update_recipient(
        env: Env,
        sender: Address,
        gift_id: u64,
        new_recipient: Address,
    ) {
        sender.require_auth();

        let mut gift = storage::get_gift(&env, gift_id);

        if gift.sender != sender {
            panic!("only the sender can update the recipient");
        }

        if gift.is_claimed {
            panic!("cannot update recipient of an already claimed gift");
        }

        let old_recipient = gift.recipient;
        gift.recipient = new_recipient.clone();
        storage::set_gift(&env, gift_id, &gift);

        events::emit_recipient_updated(
            &env,
            gift_id,
            &sender,
            &old_recipient,
            &new_recipient,
        );
    }
}
