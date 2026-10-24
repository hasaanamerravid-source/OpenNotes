/**
 * Registers the loader, so that the unit tests can import the sources of the
 * project directly.
 *
 *   node --import ./scripts/register-ts.mjs --test tests/*.test.mts
 */
import { registerHooks } from 'node:module'
import { resolve, load } from './ts-hook.mjs'

registerHooks({ resolve, load })
