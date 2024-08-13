
//
// hack code to fix up how dollar amounts are said
//

function numberToWords(num) {
	const a = [
			'', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
			'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
	];
	const b = [
			'', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
	];

	const numToWords = (n) => {
			if (n < 20) return a[n];
			if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
			if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
			return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
	};

	return numToWords(num);
}

function convertAmountToWords(amount) {
	const [dollars, cents] = amount.toFixed(2).split('.')
	const dollarPart = numberToWords(parseInt(dollars))
	const centPart = numberToWords(parseInt(cents))
	return `${dollarPart} dollars${cents > 0 ? ' and ' + centPart + ' cents' : ''}`
}

export function fix_dollars(sentence) {
	return sentence.replace(/\$\d+(\.\d{1,2})?/g, (match) => {
			const amount = parseFloat(match.replace('$', ''))
			return convertAmountToWords(amount)
	});
}