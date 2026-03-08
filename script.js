const suits = ["Hearts","Diamonds","Clubs","Spades"]

const values = ["Ace","2","3","4","5","6","7","8","9","10","Jack","Queen","King"]

const valueMap = values.reduce((m, v, i) => { m[v] = i + 1; return m }, {})

let deck = []
let tableau = [[], [], [], [], [], [], []]
let foundations = [[], [], [], []]
let waste = []
let selected = null
// cache resolved image srcs to avoid repeated failed loads and flashes
const imageCache = {}
let backImageSrc = null

function resolveBackImage(cb){
	if (backImageSrc) return cb(backImageSrc)
	const probe = new Image()
	probe.onload = () => { backImageSrc = 'assets/cards/back.png'; cb(backImageSrc) }
	probe.onerror = () => { backImageSrc = 'assets/cards/back.svg'; cb(backImageSrc) }
	probe.src = 'assets/cards/back.png'
}

function resolveCandidates(candidates, cb){
	if (!candidates || candidates.length === 0) return cb(null)
	const next = candidates.shift()
	const probe = new Image()
	probe.onload = () => cb(next)
	probe.onerror = () => resolveCandidates(candidates, cb)
	probe.src = next
}

// Initialize once DOM is ready so direct-file opens work reliably
window.addEventListener('DOMContentLoaded', () => {
	try {
		init()
	} catch (err) {
		console.error('Initialization error:', err)
	}
})

function init(){
	deck = createDeck()
	shuffle(deck)
	// clear
	tableau = [[], [], [], [], [], [], []]
	foundations = [[], [], [], []]
	waste = []
	deal()
	render()
	attachHandlers()
}

function createDeck(){
	let d = []
	for (let suit of suits){
		for (let value of values){
			d.push({ suit: suit, value: value, faceUp: false })
		}
	}
	return d
}

function shuffle(array){
	// Fisher-Yates shuffle (use `var` for compatibility)
	for (var i = array.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var tmp = array[i];
		array[i] = array[j];
		array[j] = tmp;
	}
}

function deal(){
	for (let col = 0; col < 7; col++){
		for (let row = 0; row <= col; row++){
			let card = deck.pop()
			if (row === col) card.faceUp = true
			tableau[col].push(card)
		}
	}
}

function attachHandlers(){
	const stockEl = document.getElementById('stock')
	const newGameBtn = document.getElementById('newGame')
	if (stockEl) stockEl.onclick = onStockClick
	if (newGameBtn) newGameBtn.onclick = () => { init(); hideMessage() }
	// foundation click handlers: allow dropping selected card to empty foundation
	const foundationNodes = document.querySelectorAll('#foundations .foundation')
	foundationNodes.forEach((node, i) => {
		node.onclick = (e) => { e.stopPropagation(); if (selected) tryMoveToFoundation(i) }
	})

}

function onStockClick(){
	if (deck.length > 0){
		let c = deck.pop()
		c.faceUp = true
		waste.push(c)
	} else {
		// recycle waste into deck
		while (waste.length > 0){
			let c = waste.pop()
			c.faceUp = false
			deck.push(c)
		}
	}
	clearSelection()
	renderStock()
	renderWaste()
}

function render(){
	renderStock()
	renderWaste()
	renderFoundations()
	renderTableau()
	checkWin()
}

function renderStock(){
	const stock = document.getElementById('stock')
	stock.innerHTML = ''
	if (deck.length > 0){
		let img = document.createElement('img')
		// tiny transparent placeholder to avoid showing broken icon
		img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
		img.className = 'card'
		img.draggable = false
		img.style.visibility = 'hidden'
		// prevent default navigation when clicking image files in some browsers
		img.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onStockClick(); })
		stock.appendChild(img)
		// resolve real back image and swap in when available
		resolveBackImage((src) => {
			img.onload = () => { img.style.visibility = 'visible'; img.style.transition = 'opacity 160ms ease'; img.style.opacity = '1' }
			img.onerror = null
			img.style.opacity = '0'
			img.src = src
		})
	}
}

function renderWaste(){
	const wasteEl = document.getElementById('waste')
	wasteEl.innerHTML = ''
	if (waste.length > 0){
		let card = waste[waste.length - 1]
		let el = createCardElement(card, { pile:'waste', index: waste.length - 1 })
		el.style.opacity = '0'
		wasteEl.appendChild(el)
		requestAnimationFrame(() => { el.style.transition = 'opacity 160ms ease'; el.style.opacity = '1' })
	}
}

function renderFoundations(){
	const nodes = document.querySelectorAll('#foundations .foundation')
	nodes.forEach((node, i) => {
		node.innerHTML = ''
		const pile = foundations[i]
		if (pile.length > 0){
			let top = pile[pile.length - 1]
			let el = createCardElement(top, { pile:'foundation', foundationIndex:i })
			el.style.opacity = '0'
			node.appendChild(el)
			requestAnimationFrame(() => { el.style.transition = 'opacity 160ms ease'; el.style.opacity = '1' })
		}
	})
}

function ensureTableauColumns(){
	const container = document.getElementById('tableau')
	if (!container) return
	// create missing columns if container is empty or incomplete
	while (container.children.length < 7){
		const idx = container.children.length
		const colDiv = document.createElement('div')
		colDiv.className = 'column'
		colDiv.onclick = (e) => { if (selected) tryMoveToTableau(idx) }
		container.appendChild(colDiv)
	}
	// ensure correct click handlers (fix indices)
	for (let i = 0; i < 7; i++){
		const node = container.children[i]
		if (node) node.onclick = (e) => { if (selected) tryMoveToTableau(i) }
	}
}

function renderTableauColumn(colIndex){
	const container = document.getElementById('tableau')
	if (!container) return
	ensureTableauColumns()
	const colDiv = container.children[colIndex]
	if (!colDiv) return
	colDiv.innerHTML = ''
	const column = tableau[colIndex]
	column.forEach((card, i) => {
		const cardEl = createCardElement(card, { pile:'tableau', col:colIndex, index:i })
		cardEl.style.top = (i * 28) + 'px'
		cardEl.style.zIndex = i
		cardEl.style.opacity = '0'
		colDiv.appendChild(cardEl)
	})
	// reveal all new cards in a single rAF to avoid many paints
	requestAnimationFrame(() => {
		for (let k = 0; k < colDiv.children.length; k++){
			const el = colDiv.children[k]
			el.style.transition = 'opacity 180ms ease'
			el.style.opacity = '1'
		}
	})
}

function renderTableau(){
	const container = document.getElementById('tableau')
	if (!container) return
	ensureTableauColumns()
	for (let i = 0; i < 7; i++) renderTableauColumn(i)
}

function createCardElement(card, info = {}){
	let img = document.createElement('img')
	img.className = 'card'
	// Use a tiny placeholder first to avoid showing broken-image icon while we resolve
	img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
	img.style.visibility = 'hidden'
	if (card.faceUp){
		const key = `${card.value}|${card.suit}`
		if (imageCache[key]){
			img.onload = () => { img.style.visibility = 'visible'; img.style.transition = 'opacity 160ms ease'; img.style.opacity = '1' }
			img.src = imageCache[key]
		} else {
			const candidates = filenameCandidates(card.value, card.suit)
			resolveCandidates(candidates.slice(), (src) => {
				const chosen = src || 'assets/cards/back.png'
				imageCache[key] = chosen
				img.onload = () => { img.style.visibility = 'visible'; img.style.transition = 'opacity 160ms ease'; img.style.opacity = '1' }
				img.src = chosen
			})
		}
	} else {
		resolveBackImage((src) => {
			img.onload = () => { img.style.visibility = 'visible'; img.style.transition = 'opacity 160ms ease'; img.style.opacity = '1' }
			img.src = src
		})
	}
	// store info
	if (info.pile) img.dataset.pile = info.pile
	if (typeof info.col !== 'undefined') img.dataset.col = info.col
	if (typeof info.index !== 'undefined') img.dataset.index = info.index
	if (typeof info.foundationIndex !== 'undefined') img.dataset.foundation = info.foundationIndex

	img.draggable = false
	img.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onCardClick(card, info, img) }
	return img
}

function onCardClick(card, info, el){
	// clicking face-down top card in tableau flips
	if (info.pile === 'tableau' && !card.faceUp){
		// only flip if it's the topmost card
		const col = tableau[info.col]
		if (info.index === col.length - 1){
			card.faceUp = true
			renderTableauColumn(info.col)
		}
		return
	}

	if (!card.faceUp) return

	// if nothing selected, select this card (or stack)
	if (!selected){
		selected = { card, info }
		el.classList.add('selected')
		return
	}

	// if clicked same card again -> clear selection
	if (selected.info.pile === info.pile && selected.info.col == info.col && selected.info.index == info.index) {
		clearSelection();
		return
	}

	// try to move selected -> clicked destination
	if (info.pile === 'tableau'){
		tryMoveToTableau(info.col)
	} else if (info.pile === 'foundation'){
		tryMoveToFoundation(info.foundationIndex)
	} else if (info.pile === 'waste'){
		// clicking waste on selected? treat as destination only if moving to waste would be valid (rare)
		clearSelection()
	}
}

function clearSelection(){
	selected = null
	document.querySelectorAll('.card.selected').forEach(n => n.classList.remove('selected'))
}

function tryMoveToTableau(destCol){
	if (!selected) return
	const from = selected.info.pile
	let srcCol = null
	if (from === 'tableau') srcCol = selected.info.col
	if (from === 'tableau'){
		const srcIndex = selected.info.index
		const movingStack = tableau[srcCol].slice(srcIndex)
		const movingCard = movingStack[0]
		const destColumn = tableau[destCol]
		const destTop = destColumn[destColumn.length - 1] || null
		if (canPlaceOnTableau(movingCard, destTop)){
			// move stack
			tableau[destCol] = destColumn.concat(movingStack)
			tableau[srcCol] = tableau[srcCol].slice(0, srcIndex)
			postMoveCleanup(srcCol)
		}
	} else if (from === 'waste'){
		const movingCard = waste[waste.length - 1]
		const destTop = tableau[destCol][tableau[destCol].length - 1] || null
		if (canPlaceOnTableau(movingCard, destTop)){
			tableau[destCol].push(movingCard)
			waste.pop()
		}
	} else if (from === 'foundation'){
		const fIdx = parseInt(selected.info.foundationIndex)
		const movingCard = foundations[fIdx][foundations[fIdx].length - 1]
		const destTop = tableau[destCol][tableau[destCol].length - 1] || null
		if (canPlaceOnTableau(movingCard, destTop)){
			tableau[destCol].push(movingCard)
			foundations[fIdx].pop()
		}
	}
	clearSelection()
	// Render only affected piles
	// Always refresh destination column
	renderTableauColumn(destCol)
	// If move came from tableau, refresh source column
	if (from === 'tableau' && srcCol !== null) renderTableauColumn(srcCol)
	// If move involved waste or foundations, refresh those
	if (from === 'waste') renderWaste()
	if (from === 'foundation') renderFoundations()
}

function tryMoveToFoundation(fIdx){
	if (!selected) return
	const from = selected.info.pile
	let movingCard = null
	if (from === 'tableau'){
		const srcCol = selected.info.col
		const srcIndex = selected.info.index
		// only single top card allowed to foundation
		if (srcIndex !== tableau[srcCol].length - 1) { clearSelection(); return }
		movingCard = tableau[srcCol].pop()
		if (!canPlaceOnFoundation(movingCard, fIdx)){
			// undo
			tableau[srcCol].push(movingCard)
			clearSelection();
			return
		}
		foundations[fIdx].push(movingCard)
		postMoveCleanup(srcCol)
		// render changes for tableau->foundation
		clearSelection()
		renderFoundations()
		renderTableauColumn(srcCol)
		return
	} else if (from === 'waste'){
		movingCard = waste.pop()
		if (!canPlaceOnFoundation(movingCard, fIdx)){
			waste.push(movingCard)
			clearSelection();
			return
		}
		foundations[fIdx].push(movingCard)
		// render changes for waste->foundation
		clearSelection()
		renderFoundations()
		renderWaste()
		return
	} else if (from === 'foundation'){
		clearSelection();
		return
	}
}

function postMoveCleanup(srcCol){
	// flip new top if faceDown
	const col = tableau[srcCol]
	if (col.length > 0){
		const top = col[col.length - 1]
		if (!top.faceUp) top.faceUp = true
	}
}

function canPlaceOnTableau(movingCard, destCard){
	if (!destCard){
		// empty column: only King
		return valueMap[movingCard.value] === 13
	}
	// descending by one and opposite color
	if (valueMap[destCard.value] !== valueMap[movingCard.value] + 1) return false
	return cardColor(destCard.suit) !== cardColor(movingCard.suit)
}

function canPlaceOnFoundation(card, fIdx){
	const pile = foundations[fIdx]
	if (pile.length === 0) return card.value === 'Ace'
	const top = pile[pile.length - 1]
	return (top.suit === card.suit) && (valueMap[card.value] === valueMap[top.value] + 1)
}

function cardColor(suit){
	return (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black'
}

function checkWin(){
	const complete = foundations.every(f => f.length === 13)
	if (complete){
		showMessage('You won! 🎉 — New Game to play again.')
	}
}

function showMessage(text){
	const m = document.getElementById('message')
	m.textContent = text
	m.classList.remove('hidden')
}

function hideMessage(){
	const m = document.getElementById('message')
	m.classList.add('hidden')
}

function tryNextCandidate(img, candidates){
	if (!candidates || candidates.length === 0) return
	const next = candidates.shift()
	img.src = next
	img.onerror = () => { img.onerror = null; tryNextCandidate(img, candidates) }
}

const wordMap = {
	'2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten'
}

function filenameCandidates(value, suit){
	const base = `assets/cards/`;
	const cleanSuit = suit
	const candidates = []
	// 1) as-is (e.g. "2 of Spades.png")
	candidates.push(base + `${value} of ${cleanSuit}.png`)
	// 2) word form (e.g. "Two of Spades.png")
	if (wordMap[value]) candidates.push(base + `${wordMap[value]} of ${cleanSuit}.png`)
	// 3) Title-cased value (in case values array used words already)
	const titleValue = value.charAt(0).toUpperCase() + value.slice(1)
	if (titleValue !== value) candidates.push(base + `${titleValue} of ${cleanSuit}.png`)
	// 4) possible common misspelling fix for 'Spdes' -> 'Spades'
	if (cleanSuit === 'Spades'){
		candidates.push(base + `${wordMap[value] || titleValue || value} of Spdes.png`)
	}
	return candidates
}