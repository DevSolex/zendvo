use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_savings_deposited(env: &Env, user: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("SavDep"), user.clone()),
        amount,
    );
}
