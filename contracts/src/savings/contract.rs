use soroban_sdk::{contract, contractimpl, token, Address, Env};

use crate::{
    core::{errors::ContractError, utils::MIN_DEPOSIT_AMOUNT},
    savings::{events, storage},
};

#[contract]
pub struct SavingsContract;

#[contractimpl]
impl SavingsContract {
    pub fn deposit_savings(env: Env, user: Address, amount: i128) -> Result<(), ContractError> {
        user.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        if amount < MIN_DEPOSIT_AMOUNT {
            return Err(ContractError::AmountTooSmall);
        }

        let token_address = storage::get_token_address(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let mut record = storage::get_user_savings(&env, &user);
        record.principal = record
            .principal
            .checked_add(amount)
            .ok_or(ContractError::Overflow)?;
        storage::set_user_savings(&env, &user, &record);

        events::emit_savings_deposited(&env, &user, amount);

        Ok(())
    }
}
