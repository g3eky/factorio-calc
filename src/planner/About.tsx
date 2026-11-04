import { Modal } from '../ui/Modal/Modal.tsx'
import styles from './About.module.css'

export function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About" onClose={onClose}>
      <div className={styles.about}>
        <p>A production calculator for Factorio, styled like the game. Everything runs in your browser; your settings stay on this device.</p>
        <h3>Credits</h3>
        <ul>
          <li>
            Factorio is a game by <a href="https://factorio.com">Wube Software</a>. This is an unofficial fan project, not affiliated with Wube. Factorio's
            names and art belong to Wube Software.
          </li>
          <li>
            Game data comes from Wube's <a href="https://github.com/wube/factorio-data">factorio-data</a>.
          </li>
          <li>
            Item names and icons come from the <a href="https://wiki.factorio.com">official Factorio wiki</a> (text under CC BY-NC-SA 3.0).
          </li>
          <li>
            Fonts: <a href="https://fonts.google.com/specimen/Saira+Condensed">Saira Condensed</a>,{' '}
            <a href="https://fonts.google.com/specimen/IBM+Plex+Sans">IBM Plex Sans</a> and <a href="https://fonts.google.com/specimen/IBM+Plex+Mono">IBM Plex Mono</a>,
            SIL Open Font License. Solver:{' '}
            <a href="https://highs.dev">HiGHS</a>. Database: <a href="https://sql.js.org">sql.js</a>.
          </li>
        </ul>
        <h3>Shortcuts</h3>
        <ul>
          <li>
            <kbd>/</kbd> search the Catalog
          </li>
          <li>
            <kbd>T</kbd> switch Production between Table and Tree
          </li>
        </ul>
        <p>
          Source: <a href="https://github.com/g3eky/factorio-calc">github.com/g3eky/factorio-calc</a>
        </p>
      </div>
    </Modal>
  )
}
