import { useState } from 'react';
import {
  getOrientationLabel,
  getVideoTypeLabel,
  getModeLabel,
  groupVideosByBranch,
} from './branchHelpers.js';

export default function BranchTree({
  branches = [],
  videos = [],
  activeVideoId = null,
  selectedBranchId = null,
  expandedBranchIds = new Set(),
  onToggleBranch,
  onSelectBranch,
  onSelectVideo,
  onCreateVideo,
  onNewBranch,
  onEditBranch,
  onDeleteBranch,
  isCollapsed = false,
  onToggleCollapse,
  videoStagesMap = {},
}) {
  const [menuBranchId, setMenuBranchId] = useState(null);

  if (isCollapsed) {
    return (
      <aside className="branch-tree branch-tree--collapsed" aria-label="Panel de ramas colapsado">
        <button
          type="button"
          className="branch-tree__toggle-button"
          title="Mostrar ramas y videos"
          aria-label="Mostrar ramas y videos"
          onClick={onToggleCollapse}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </aside>
    );
  }

  const grouped = groupVideosByBranch(branches, videos);

  return (
    <aside className="branch-tree" aria-label="Ramas y videos">
      <div className="branch-tree__header">
        <div className="branch-tree__title-row">
          <span className="branch-tree__title">Ramas y videos</span>
          <button
            type="button"
            className="branch-tree__icon-btn"
            title="Ocultar panel"
            aria-label="Ocultar panel"
            onClick={onToggleCollapse}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="settings__button settings__button--primary branch-tree__new-branch-btn"
          onClick={onNewBranch}
        >
          + Nueva rama
        </button>
      </div>

      <div className="branch-tree__content">
        {grouped.map(({ branch, videos: branchVideos }) => {
          const isExpanded = expandedBranchIds.has(branch.id);
          const isMenuOpen = menuBranchId === branch.id;
          const isSelected = selectedBranchId === branch.id;

          return (
            <div key={branch.id} className="branch-tree__branch">
              {/* Branch Header */}
              <div
                className={`branch-tree__branch-header${isExpanded ? ' branch-tree__branch-header--expanded' : ''}${isSelected ? ' branch-tree__branch-header--selected' : ''}`}
                onClick={() => {
                  onSelectBranch?.(branch.id);
                  if (!isExpanded) onToggleBranch?.(branch.id);
                }}
              >
                <div className="branch-tree__branch-top">
                  <span
                    className={`branch-tree__chevron${isExpanded ? ' branch-tree__chevron--expanded' : ''}`}
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBranch?.(branch.id);
                    }}
                  >
                    ▶
                  </span>
                  <span className="branch-tree__branch-name" title={branch.name}>
                    {branch.name}
                  </span>

                  {/* Actions context menu trigger */}
                  <div
                    className="branch-tree__menu-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="branch-tree__icon-btn"
                      title="Opciones de rama"
                      aria-label={`Opciones de la rama ${branch.name}`}
                      aria-expanded={isMenuOpen}
                      onClick={() => setMenuBranchId((prev) => (prev === branch.id ? null : branch.id))}
                    >
                      ⋯
                    </button>

                    {isMenuOpen && (
                      <div className="branch-tree__menu-dropdown" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="branch-tree__menu-item"
                          onClick={() => {
                            setMenuBranchId(null);
                            onSelectBranch?.(branch.id);
                          }}
                        >
                          {branch.mode === 'series'
                            ? 'Planificar serie'
                            : branch.mode === 'titles'
                            ? 'Banco de títulos'
                            : 'Panel de rama'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="branch-tree__menu-item"
                          onClick={() => {
                            setMenuBranchId(null);
                            onEditBranch(branch);
                          }}
                        >
                          Editar rama
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="branch-tree__menu-item branch-tree__menu-item--danger"
                          onClick={() => {
                            setMenuBranchId(null);
                            onDeleteBranch(branch);
                          }}
                        >
                          Eliminar rama
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="branch-tree__badges">
                  <span className="branch-tree__badge branch-tree__badge--orientation">
                    {getOrientationLabel(branch.orientation)}
                  </span>
                  <span className="branch-tree__badge branch-tree__badge--type">
                    {getVideoTypeLabel(branch.videoType)}
                  </span>
                  <span className="branch-tree__badge branch-tree__badge--mode">
                    {getModeLabel(branch.mode)}
                  </span>
                </div>
              </div>

              {/* Videos list when expanded */}
              {isExpanded && (
                <div className="branch-tree__videos">
                  {branchVideos.map((vid) => {
                    const isActive = vid.id === activeVideoId;
                    const stageInfo = videoStagesMap[vid.id];

                    return (
                      <div
                        key={vid.id}
                        className={`branch-tree__video-item${isActive ? ' branch-tree__video-item--active' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => onSelectVideo(vid.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectVideo(vid.id);
                          }
                        }}
                      >
                        <span className="branch-tree__video-title" title={vid.title || 'Video sin título'}>
                          {vid.title || 'Video sin título'}
                        </span>

                        {stageInfo && (
                          <span
                            className="branch-tree__video-progress"
                            title={`${stageInfo.doneCount} de ${stageInfo.total} etapas completadas`}
                          >
                            {stageInfo.doneCount}/{stageInfo.total}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="branch-tree__add-video-btn"
                    onClick={() => onCreateVideo(branch.id)}
                  >
                    + Nuevo video
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
