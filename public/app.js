const catalog = {
	'pocket-30': { name: 'Pocket 30', price: 24 },
	'desk-65': { name: 'Desk 65', price: 42 },
	'power-100': { name: 'Power 100', price: 68 },
};

const cart = new Map();
const cartItems = document.querySelector('#cart-items');
const bagCount = document.querySelector('#bag-count');
const itemCount = document.querySelector('#item-count');
const checkoutButton = document.querySelector('#checkout-button');
const checkoutMessage = document.querySelector('#checkout-message');
const trackingMessage = document.querySelector('#tracking-message');
const toast = document.querySelector('#toast');
let toastTimer;

function money(amount) {
	return `$${amount.toFixed(2)}`;
}

function renderCart() {
	const entries = [...cart.entries()];
	const quantity = entries.reduce((total, [, count]) => total + count, 0);
	const subtotal = entries.reduce(
		(total, [id, count]) => total + catalog[id].price * count,
		0,
	);
	bagCount.textContent = quantity;
	itemCount.textContent = `${quantity} ${quantity === 1 ? 'item' : 'items'}`;
	document.querySelector('#subtotal').textContent = money(subtotal);
	document.querySelector('#total').textContent = money(subtotal);
	checkoutButton.disabled = quantity === 0;

	if (!entries.length) {
		cartItems.innerHTML =
			'<p class="empty-cart">Your bag is taking a breather.<br>Pick a charger to get started.</p>';
		return;
	}

	cartItems.replaceChildren(
		...entries.map(([id, count]) => {
			const row = document.createElement('div');
			row.className = 'cart-row';
			row.innerHTML = `<div><div class="cart-row-name">${catalog[id].name}</div><div class="cart-row-price">${money(catalog[id].price)} each</div></div><div class="quantity-control"><button type="button" data-change="-1" data-id="${id}" aria-label="Remove one ${catalog[id].name}">−</button><span>${count}</span><button type="button" data-change="1" data-id="${id}" aria-label="Add one ${catalog[id].name}">+</button></div><button class="remove-item" type="button" data-remove="${id}" aria-label="Remove ${catalog[id].name}">×</button>`;
			return row;
		}),
	);
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('is-visible');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

document.querySelectorAll('[data-add]').forEach((button) => {
	button.addEventListener('click', () => {
		const id = button.dataset.add;
		cart.set(id, (cart.get(id) || 0) + 1);
		renderCart();
		showToast(`${catalog[id].name} added to your bag`);
	});
});

cartItems.addEventListener('click', (event) => {
	const changeButton = event.target.closest('[data-change]');
	const removeButton = event.target.closest('[data-remove]');
	if (changeButton) {
		const id = changeButton.dataset.id;
		const next = (cart.get(id) || 0) + Number(changeButton.dataset.change);
		if (next > 0) cart.set(id, next);
		else cart.delete(id);
		renderCart();
	} else if (removeButton) {
		cart.delete(removeButton.dataset.remove);
		renderCart();
	}
});

document
	.querySelector('#checkout-form')
	.addEventListener('submit', async (event) => {
		event.preventDefault();
		checkoutMessage.textContent = '';
		checkoutButton.disabled = true;
		checkoutButton.querySelector('span:first-child').textContent =
			'Opening secure checkout…';

		try {
			const response = await fetch('/api/create-checkout-session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: document.querySelector('#checkout-email').value,
					items: [...cart.entries()].map(([id, quantity]) => ({
						id,
						quantity,
					})),
				}),
			});
			const result = await response.json();
			if (!response.ok)
				throw new Error(result.error || 'Checkout could not be started.');
			window.location.assign(result.url);
		} catch (error) {
			checkoutMessage.textContent = error.message;
			checkoutButton.disabled = cart.size === 0;
		} finally {
			checkoutButton.querySelector('span:first-child').textContent =
				'Continue to payment';
		}
	});

async function trackOrder(reference, target) {
	target.textContent = 'Looking up your order…';
	target.classList.remove('tracking-result');
	try {
		const response = await fetch(
			`/api/orders/${encodeURIComponent(reference)}`,
		);
		const order = await response.json();
		if (!response.ok)
			throw new Error(order.error || 'We could not find that order.');
		if (order.status === 'paid') {
			target.textContent = `Payment received · ${money(order.total / 100)} · receipt email: ${order.email || 'not available'}.`;
		} else {
			target.textContent = `Order ${order.orderId} is ${order.status}.`;
		}
		target.classList.add('tracking-result');
	} catch (error) {
		target.textContent = error.message;
	}
}

document.querySelector('#tracking-form').addEventListener('submit', (event) => {
	event.preventDefault();
	trackOrder(
		document.querySelector('#tracking-reference').value.trim(),
		trackingMessage,
	);
});

const query = new URLSearchParams(window.location.search);
if (query.get('checkout') === 'success' && query.get('session_id')) {
	const reference = query.get('session_id');
	document.querySelector('#tracking-reference').value = reference;
	trackOrder(reference, trackingMessage);
	showToast('Payment complete. Your order is on its way.');
	history.replaceState({}, '', '/');
} else if (query.get('checkout') === 'cancelled') {
	showToast('Checkout cancelled. Your bag is still here.');
	history.replaceState({}, '', '/');
} else if (query.get('track')) {
	const reference = query.get('track');
	document.querySelector('#tracking-reference').value = reference;
	trackOrder(reference, trackingMessage);
	document
		.querySelector('#tracking-heading')
		.scrollIntoView({ behavior: 'smooth', block: 'center' });
	history.replaceState({}, '', '/');
}

renderCart();
