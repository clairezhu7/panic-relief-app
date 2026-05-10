// setTimeout(() => window.electronAPI.navigate('home'), 3500)

runTextAnimation()

function runTextAnimation() {
    const mindstep = document.getElementById('mindstep')
    const line = document.getElementById('line')
    const letters = document.querySelectorAll('#relax span')

    setTimeout(() => {
        mindstep.style.transition = 'opacity 0.9s ease, filter 0.9s ease, transform 0.9s ease'
        mindstep.style.opacity = '0.95'
        mindstep.style.filter = 'blur(0px)'
        mindstep.style.transform = 'scale(1)'
    }, 1100)

    setTimeout(() => {
        line.style.transition = 'width 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease'
        line.style.width = '25%'
        line.style.opacity = '1'
    }, 1700)

    letters.forEach((l, i) => {
        setTimeout(() => {
            l.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
            l.style.opacity = '1'
            l.style.transform = 'translateY(0)'
        }, 1900 + i * 100)
    })


    const taglineWords = document.querySelectorAll("#tagline > span");

    taglineWords.forEach((word, i) => {
        word.style.transition = 'none'
        word.style.opacity = '0'
    })

    taglineWords.forEach((word, i) => {
        setTimeout(() => {
            word.style.transition = 'opacity 0.5s ease'
            word.style.opacity = '1'
        }, 2500 + i * 300)  // starts 0.1s after relax finishes, 300ms between each
    })
}