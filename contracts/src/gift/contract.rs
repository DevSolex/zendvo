use soroban_sdk::{contract, contractimpl, token, Address, Env};

use crate::core::errors::ContractError;
use crate::gift::{
    events::emit_gift_created,
    storage::{get_gift_counter, get_token_address, set_gift, set_gift_counter},
    types::{DataKey, Gift},
};

/// Entry point for the time-locked gift contract.
#[contract]
pub struct GiftContract;

#[contractimpl]
impl GiftContract {
    /// Initializes the contract with a backend admin address and the USDC
    /// token contract address.
    ///
    /// Must be called exactly once immediately after deployment.
    /// Reverts if the admin has already been set, preventing any actor
    /// from overwriting admin rights post-deployment.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
    ) -> Result<(), ContractError> {
        // Guard: panic if already initialized to prevent admin hijacking.
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);

        Ok(())
    }

    /// Locks USDC from `sender` into the contract as a time-locked gift for
    /// `recipient`, releasing after `unlock_time` (Unix timestamp in seconds).
    ///
    /// The transfer and record creation are atomic: if the token transfer
    /// fails (insufficient balance, missing trustline, etc.) the entire
    /// invocation reverts and no gift record is written.
    ///
    /// Returns the newly generated `gift_id`.
    pub fn create_gift(
        env: Env,
        sender: Address,
        recipient: Address,
        amount: i128,
        unlock_time: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();

        let token_address = get_token_address(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let gift_id = get_gift_counter(&env) + 1;
        set_gift_counter(&env, gift_id);

        let gift = Gift {
            sender: sender.clone(),
            recipient: recipient.clone(),
            amount,
            unlock_time,
            is_claimed: false,
        };
        set_gift(&env, gift_id, &gift);

        emit_gift_created(&env, gift_id, &sender, &recipient, amount, unlock_time);

        Ok(gift_id)
    }
}
