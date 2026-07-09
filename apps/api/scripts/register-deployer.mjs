import 'dotenv/config'
import { registerContentAsDeployer } from '../src/lib/arc.js'

const [,, canonicalUrl, price] = process.argv
if (!canonicalUrl || !price) {
  console.error('Usage: node register-deployer.mjs <canonical_url> <price_usdc>')
  process.exit(1)
}

;(async () => {
  try {
    const priceUnits = Math.round(parseFloat(price) * 1_000_000)
    console.log('Calling registerContentAsDeployer with:', { canonicalUrl, priceUnits })
    const res = await registerContentAsDeployer(canonicalUrl, priceUnits)
    console.log('Result:', res)
  } catch (err) {
    console.error('Error:', err.message || err)
    process.exit(1)
  }
})()
