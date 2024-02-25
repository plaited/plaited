import { css } from 'plaited'

export const { $stylesheet, ...cls } = css`
  :host {
    display: block;
    width: 100%;
    height: 100vh;
  }
  .canvas {
    width: 100%;
    height: 100%;
    overflow: auto;
  }
  .graph > polygon {
    fill: transparent;
  }

  .run {
  }
  .event {
  }
  /* Edges Styling */

  .edge {
    cursor: pointer;
    & .edge-path {
      stroke: currentColor;
      stroke-width: 2;
    }

    & .hover-path {
      stroke: transparent;
      stroke-width: 15;
    }

    .selected,
    &:hover {
      & .edge-path {
        @apply stroke-pink-400;
        stroke-width: 3;
      }

      & polygon {
        @apply stroke-pink-400 fill-pink-400;
        opacity: 1;
      }
    }

    & polygon {
      fill: currentColor;
      stroke: currentColor;
    }
  }

  /** module */
  .module-title {
    & > polygon {
      @apply fill-green-400 stroke-green-400;
    }
    & > text {
      @apply fill-white;
    }
  }

  /* verb */
  .module-verb {
    & polygon {
      @apply stroke-green-400 fill-gray-800;
    }
    & text {
      @apply fill-white;
    }
  }

  /* Nodes Styling */
  .node {
    pointer-events: bounding-box;
    cursor: pointer;
  }

  .call-link {
    @apply text-white;
  }

  .call-source {
  }
`
