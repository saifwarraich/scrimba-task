const input = document.getElementById('queryInput') as HTMLInputElement
const btn = document.getElementById('generateBtn') as HTMLButtonElement
const errorMsg = document.getElementById('errorMsg') as HTMLDivElement
const overlay = document.getElementById('loadingOverlay') as HTMLDivElement

document.querySelectorAll<HTMLButtonElement>('.pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    input.value = pill.dataset.query || ''
    input.focus()
  })
})

async function submit() {
  const query = input.value.trim()
  if (!query) {
    errorMsg.textContent = 'Please enter a question first.'
    return
  }
  errorMsg.textContent = ''
  btn.disabled = true
  overlay.classList.add('active')

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }))
      throw new Error(err.error || 'Server error')
    }

    const { lessonId } = await res.json()
    window.location.href = `/player.html?id=${lessonId}&q=${encodeURIComponent(query)}`
  } catch (err) {
    errorMsg.textContent = String(err)
    btn.disabled = false
    overlay.classList.remove('active')
  }
}

btn.addEventListener('click', submit)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit()
})
