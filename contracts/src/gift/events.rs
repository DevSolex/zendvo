use soroban_sdk::{symbol_short, Address, Env};

/// Emitted when a sender redirects a pending gift to a new recipient.
///
/// Topics : ["RecipientUpdated", sender]
/// Data   : (gift_id, old_recipient, new_recipient)
pub fn emit_recipient_updated(
    env: &Env,
    gift_id: u64,
    sender: &Address,
    old_recipient: &Address,
    new_recipient: &Address,
) {
    env.events().publish(
        (symbol_short!("RecipUpd"), sender.clone()),
        (gift_id, old_recipient.clone(), new_recipient.clone()),
    );
}

/// Emitted when a new time-locked gift is created.
///
/// Topics : ["GiftCreated", sender]
/// Data   : (gift_id, recipient, amount, unlock_time)
pub fn emit_gift_created(
    env: &Env,
    gift_id: u64,
    sender: &Address,
    recipient: &Address,
    amount: i128,
    unlock_time: u64,
) {
    env.events().publish(
        (symbol_short!("GiftCrtd"), sender.clone()),
        (gift_id, recipient.clone(), amount, unlock_time),
    );
}
