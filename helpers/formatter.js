const phoneNumberFormatter = function(number) {
    // 1. menghilangkan karakter selain angka
    let formatted = 0;
    
    if(/^\d+$/.test(number)) {
        formatted = number;
    } else {
        formatted = number.replace(/\D/g, '');
    }
    

    // 2. menghilangkan angka 0 di depan (prefix)
    //      kemudian diganti dgn 62
    if(formatted.startsWith('0')) {
        formatted = '62' + formatted.substr(1);
    }

    // 3. tambahkan string di akhir
    if(!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }

    return formatted;
}

module.exports = {
    phoneNumberFormatter
}