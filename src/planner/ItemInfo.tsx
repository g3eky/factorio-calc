// Factoriopedia-style details for an item or fluid: how it's made, what makes it, and its stats.

import { useGame } from '../db/GameProvider.tsx'
import type { Ingredient, Result } from '../db/types.ts'
import { expected } from '../calculator/processes.ts'
import { Icon } from '../ui/Icon/Icon.tsx'
import { duration, long, power } from './format.ts'
import { recipesFor } from './state.ts'
import styles from './ItemInfo.module.css'

function Amount({ a }: { a: Ingredient | Result }) {
  const game = useGame()
  const name = (a.type === 'fluid' ? game.fluids : game.items).get(a.id)?.name ?? a.id
  const n = 'probability' in a || 'extra_fraction' in a || 'amount_min' in a ? expected(a as Result).base : (a.amount ?? 1)
  return (
    <span className={styles.amount}>
      <Icon kind={a.type} id={a.id} size={24} /> <strong>{long(n)} ×</strong> {name}
    </span>
  )
}

export function ItemInfo({ kind, id }: { kind: 'item' | 'fluid'; id: string }) {
  const game = useGame()
  const item = kind === 'item' ? game.items.get(id) : undefined
  const fluid = kind === 'fluid' ? game.fluids.get(id) : undefined
  // The first recipe that mainly makes it, as Factoriopedia shows; others are listed by name.
  const [recipe, ...others] = recipesFor(game, kind, id)
  const machines = recipe ? game.data.machines.filter((m) => m.categories.some((c) => recipe.categories.includes(c))) : []
  return (
    <div className={styles.info}>
      {recipe && (
        <section className={styles.section}>
          <strong className={styles.heading}>Ingredients:</strong>
          {recipe.ingredients.map((i) => (
            <Amount key={`${i.type}/${i.id}`} a={i} />
          ))}
          <span className={styles.time}>
            <strong>{long(recipe.time)} s</strong> Crafting time
          </span>
        </section>
      )}
      {recipe && recipe.results.length > 1 && (
        <section className={styles.section}>
          <strong className={styles.heading}>Products:</strong>
          {recipe.results.map((r) => (
            <Amount key={`${r.type}/${r.id}`} a={r} />
          ))}
        </section>
      )}
      {machines.length > 0 && (
        <section className={styles.section}>
          <strong className={styles.heading}>Made in:</strong>
          <span className={styles.icons}>
            {machines.map((m) => (
              <Icon key={m.id} kind="machine" id={m.id} size={28} />
            ))}
          </span>
        </section>
      )}
      {others.length > 0 && (
        <section className={styles.section}>
          <strong className={styles.heading}>Other recipes:</strong>
          <span>{others.map((r) => r.name).join(', ')}</span>
        </section>
      )}
      <section className={styles.section}>
        {item && (
          <span>
            <strong className={styles.heading}>Stack size:</strong> {item.stack_size}
          </span>
        )}
        {item?.fuel && (
          <span>
            <strong className={styles.heading}>Fuel value:</strong> {power(item.fuel.value).replace('W', 'J')}
          </span>
        )}
        {fluid?.fuel_value && (
          <span>
            <strong className={styles.heading}>Fuel value:</strong> {power(fluid.fuel_value).replace('W', 'J')}
          </span>
        )}
        {item?.spoil && (
          <span>
            <strong className={styles.heading}>Spoils in:</strong> {duration(item.spoil.time)}
          </span>
        )}
        <span className={styles.click}>Click to make it; click again to stop.</span>
      </section>
    </div>
  )
}
