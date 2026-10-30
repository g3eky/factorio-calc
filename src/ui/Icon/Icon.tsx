import { useGame } from '../../db/GameProvider.tsx'
import { cx } from '../cx.ts'
import styles from './Icon.module.css'

export type IconKind = 'item' | 'fluid' | 'recipe' | 'machine' | 'planet'

interface Props {
  kind: IconKind
  id: string
  size?: number
  className?: string
}

// One icon from the dataset's atlas. Recipes without their own icon show their main product;
// machines without one show their item. Anything else missing shows its initials.
export function Icon({ kind, id, size = 32, className }: Props) {
  const game = useGame()
  let key = `${kind}/${id}`
  const atlas = game.icons
  if (atlas && !atlas.positions.has(key)) {
    if (kind === 'recipe') {
      const recipe = game.recipes.get(id)
      const product = recipe?.results.find((r) => r.id === recipe.main_product) ?? recipe?.results[0]
      if (product) key = `${product.type}/${product.id}`
    } else if (kind === 'machine') key = `item/${id}`
  }
  const position = atlas?.positions.get(key)
  if (!atlas || !position) {
    return (
      <span className={cx(styles.icon, styles.missing, className)} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
        {id.split('-').map((word) => word[0]?.toUpperCase()).join('').slice(0, 2)}
      </span>
    )
  }
  const scale = size / atlas.size
  return (
    <span
      className={cx(styles.icon, className)}
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas.url})`,
        backgroundPosition: `${-position[0] * scale}px ${-position[1] * scale}px`,
        backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
      }}
    />
  )
}
