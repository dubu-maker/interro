import type {
  DossierDefinition,
  DossierDocument,
  DossierPage,
  DossierPhotoBlock,
  DossierQuote,
  DossierRequest,
  DossierState,
} from '../engine/dossier';

export type DossierViewMode = 'documents' | 'requests';

export interface DossierViewCallbacks {
  onClose: () => void;
  onOpenDocument: (documentId: string) => void;
  onInspectDiscovery: (documentId: string, discoveryId: string) => void;
  onAttachQuote: (quoteId: string) => void;
  onRequestAnalysis: (requestId: string) => void;
}

export interface DossierViewStatus {
  attachedQuoteId?: string;
  disabled?: boolean;
}

export interface DossierViewOptions extends DossierViewStatus {
  initialDocumentId?: string;
  initialMode?: DossierViewMode;
}

const groupOrder = [
  'INITIAL',
  'REFERENCE',
  'EXAMINATION',
  'RESULT',
] as const;

const groupLabels: Record<(typeof groupOrder)[number], string> = {
  INITIAL: '초동 기록',
  REFERENCE: '참고 자료',
  EXAMINATION: '감식·검시',
  RESULT: '추가 감식 기록',
};

const documentKindLabels: Record<DossierDocument['kind'], string> = {
  OFFICIAL_REPORT: '공식 보고서',
  HANDWRITTEN_STATEMENT: '자필 진술서',
  PHOTO_SET: '현장 사진',
  FLOOR_PLAN: '시설 도면',
  PRINTED_EXCERPT: '발췌 인쇄물',
  MEDICAL_REPORT: '검시 문서',
  LOG: '기록 출력물',
};

const requestKindLabels: Record<DossierRequest['kind'], string> = {
  FORENSIC: '감식',
  RECORDS: '기록 조회',
  RESTORATION: '복원',
};

let dossierViewSequence = 0;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createButton(className: string, text: string): HTMLButtonElement {
  const button = createElement('button', className, text);
  button.type = 'button';
  return button;
}

function documentKindClass(kind: DossierDocument['kind']): string {
  return kind.toLocaleLowerCase().replaceAll('_', '-');
}

function setPercentRect(
  element: HTMLElement,
  rect: { x: number; y: number; width: number; height: number },
): void {
  element.style.left = `${rect.x}%`;
  element.style.top = `${rect.y}%`;
  element.style.width = `${rect.width}%`;
  element.style.height = `${rect.height}%`;
}

function setZoneRect(
  element: HTMLElement,
  zone: { x: number; y: number; width: number; height: number },
): void {
  element.style.left = `${zone.x}%`;
  element.style.top = `${zone.y}%`;
  element.style.width = `${zone.width}%`;
  element.style.height = `${zone.height}%`;
}

/**
 * 사건 서류철의 DOM 표현만 담당한다.
 *
 * 엔진 상태를 직접 바꾸지 않고 모든 의미 있는 동작을 콜백으로 넘긴다.
 * 메인 화면은 콜백에서 결정론적 dossier reducer를 실행한 뒤 update()로
 * 새 상태를 돌려주면 된다.
 */
export class DossierView {
  readonly element: HTMLElement;

  private readonly definition: DossierDefinition;
  private readonly callbacks: DossierViewCallbacks;
  private readonly instanceId: string;
  private state: DossierState;
  private status: DossierViewStatus;
  private mode: DossierViewMode;
  private activeDocumentId: string | undefined;
  private readonly activePageIds = new Map<string, string>();
  private selectedQuoteId: string | undefined;
  private destroyed = false;

  constructor(
    host: HTMLElement,
    definition: DossierDefinition,
    state: DossierState,
    callbacks: DossierViewCallbacks,
    options: DossierViewOptions = {},
  ) {
    this.definition = definition;
    this.state = state;
    this.callbacks = callbacks;
    this.status = {
      attachedQuoteId: options.attachedQuoteId,
      disabled: options.disabled ?? false,
    };
    this.mode = options.initialMode ?? 'documents';
    this.instanceId = `dossier-view-${++dossierViewSequence}`;
    this.activeDocumentId =
      options.initialDocumentId ?? this.acquiredDocuments()[0]?.id;
    this.element = createElement('section', 'dossier-shell');
    this.element.dataset.dossierView = this.instanceId;
    this.element.setAttribute('aria-label', definition.title);
    this.element.addEventListener('keydown', this.handleShellKeydown);
    host.replaceChildren(this.element);
    this.normalizeSelection();
    this.render(false);
  }

  /**
   * 서류철이 실제로 화면에 열렸을 때 호출한다. 최초로 보이는 문서를
   * OPEN_DOCUMENT 액션과 연결하면서 생성자 안의 상태 변경 부작용은 피한다.
   */
  activate(): void {
    const documentId = this.activeDocumentId;
    if (
      this.destroyed ||
      this.mode !== 'documents' ||
      !documentId ||
      this.state.openedDocumentIds.includes(documentId)
    ) {
      return;
    }
    this.callbacks.onOpenDocument(documentId);
  }

  update(state: DossierState, status: DossierViewStatus = {}): void {
    if (this.destroyed) return;
    this.state = state;
    this.status = { ...this.status, ...status };
    this.normalizeSelection();
    this.render();
  }

  getActiveDocumentId(): string | undefined {
    return this.activeDocumentId;
  }

  getMode(): DossierViewMode {
    return this.mode;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.element.remove();
  }

  private acquiredDocuments(): DossierDocument[] {
    const acquired = new Set(this.state.acquiredDocumentIds);
    return this.definition.documents.filter((document) =>
      acquired.has(document.id),
    );
  }

  private isSupplementalDocument(documentId: string): boolean {
    return !this.definition.initialDocumentIds.includes(documentId);
  }

  private normalizeSelection(): void {
    const documents = this.acquiredDocuments();
    if (
      !this.activeDocumentId ||
      !documents.some((document) => document.id === this.activeDocumentId)
    ) {
      this.activeDocumentId = documents[0]?.id;
    }

    const activeDocument = documents.find(
      (document) => document.id === this.activeDocumentId,
    );
    if (activeDocument) {
      const storedPageId = this.activePageIds.get(activeDocument.id);
      if (
        !storedPageId ||
        !activeDocument.pages.some((page) => page.id === storedPageId)
      ) {
        const firstPageId = activeDocument.pages[0]?.id;
        if (firstPageId) {
          this.activePageIds.set(activeDocument.id, firstPageId);
        }
      }
    }

    if (
      this.selectedQuoteId &&
      !this.definition.quotes.some(
        (quote) =>
          quote.id === this.selectedQuoteId &&
          this.state.acquiredDocumentIds.includes(quote.documentId),
      )
    ) {
      this.selectedQuoteId = undefined;
    }
  }

  private captureScrollPositions(): Map<string, number> {
    const positions = new Map<string, number>();
    for (const element of this.element.querySelectorAll<HTMLElement>(
      '[data-dossier-scroll]',
    )) {
      const key = element.dataset.dossierScroll;
      if (key) positions.set(key, element.scrollTop);
    }
    return positions;
  }

  private restoreScrollPositions(positions: ReadonlyMap<string, number>): void {
    for (const element of this.element.querySelectorAll<HTMLElement>(
      '[data-dossier-scroll]',
    )) {
      const key = element.dataset.dossierScroll;
      if (!key) continue;
      const scrollTop = positions.get(key);
      if (scrollTop !== undefined) element.scrollTop = scrollTop;
    }
  }

  private render(preserveScroll = true): void {
    const positions = preserveScroll
      ? this.captureScrollPositions()
      : new Map<string, number>();
    this.element.classList.toggle(
      'dossier-shell--disabled',
      this.status.disabled === true,
    );
    this.element.dataset.mode = this.mode;
    const panel =
      this.mode === 'documents'
        ? this.renderDocumentsPanel()
        : this.renderRequestsPanel();
    const children: HTMLElement[] = [this.renderTopbar(), panel];
    if (this.mode === 'documents') {
      children.push(this.renderQuoteToolbar());
    }
    this.element.replaceChildren(...children);
    this.restoreScrollPositions(positions);
  }

  private renderTopbar(): HTMLElement {
    const topbar = createElement('header', 'dossier-topbar');
    const navigation = createElement('nav', 'dossier-mode-tabs');
    navigation.setAttribute('role', 'tablist');
    navigation.setAttribute('aria-label', '서류철 보기');
    const modes: readonly {
      id: DossierViewMode;
      label: string;
    }[] = [
      { id: 'documents', label: '사건 문서' },
      { id: 'requests', label: '감식·조회 의뢰' },
    ];

    for (const [index, mode] of modes.entries()) {
      const button = createButton('dossier-mode-tab', mode.label);
      const selected = this.mode === mode.id;
      button.id = `${this.instanceId}-mode-${mode.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute(
        'aria-controls',
        `${this.instanceId}-${mode.id}-panel`,
      );
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('active', selected);
      button.disabled = this.status.disabled === true;
      button.addEventListener('click', () => this.selectMode(mode.id));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const next = modes[(index + direction + modes.length) % modes.length];
        if (!next) return;
        this.selectMode(next.id);
        this.element
          .querySelector<HTMLButtonElement>(
            `#${this.instanceId}-mode-${next.id}`,
          )
          ?.focus();
      });
      navigation.append(button);
    }

    const documents = this.acquiredDocuments();
    const activeDocument = documents.find(
      (document) => document.id === this.activeDocumentId,
    );
    const activeIndex = activeDocument
      ? documents.findIndex((document) => document.id === activeDocument.id)
      : -1;
    const title = createElement(
      'span',
      'dossier-active-document',
      this.mode === 'documents' && activeDocument
        ? `${activeDocument.id} · ${activeDocument.title}`
        : '감식·조회 의뢰',
    );
    const status = createElement(
      'span',
      'dossier-reading-status',
      this.mode === 'documents'
        ? '열람 중'
        : `분석 자원 ${Math.max(
            0,
            this.definition.forensicSlotCount -
              this.state.spentForensicSlots,
          )}/${this.definition.forensicSlotCount}`,
    );
    const spacer = createElement('span', 'dossier-topbar__spacer');
    const divider = (): HTMLSpanElement =>
      createElement('span', 'dossier-topbar__divider');

    topbar.append(navigation, divider(), title, status, spacer);

    if (this.mode === 'documents') {
      const previous = createButton('dossier-nav-button', '‹');
      previous.setAttribute('aria-label', '이전 문서');
      previous.title = '이전 문서 (←)';
      previous.disabled =
        this.status.disabled === true || documents.length < 2;
      previous.addEventListener('click', () => this.navigateDocument(-1));

      const next = createButton('dossier-nav-button', '›');
      next.setAttribute('aria-label', '다음 문서');
      next.title = '다음 문서 (→)';
      next.disabled = this.status.disabled === true || documents.length < 2;
      next.addEventListener('click', () => this.navigateDocument(1));

      const counter = createElement(
        'span',
        'dossier-document-counter',
        `${activeIndex >= 0 ? activeIndex + 1 : 0} / ${documents.length}`,
      );
      topbar.append(previous, next, counter);
    }

    const close = createButton('dossier-close dossier-nav-button', '×');
    close.setAttribute('aria-label', '사건 서류 닫기');
    close.title = '사건 서류 닫기 (Esc)';
    close.addEventListener('click', this.callbacks.onClose);
    topbar.append(divider(), close);
    return topbar;
  }

  private selectMode(mode: DossierViewMode): void {
    if (this.status.disabled || this.mode === mode) return;
    this.mode = mode;
    this.render();
    if (mode === 'documents') this.activate();
  }

  private renderDocumentsPanel(): HTMLElement {
    const panel = createElement('div', 'dossier-documents-panel');
    panel.id = `${this.instanceId}-documents-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute(
      'aria-labelledby',
      `${this.instanceId}-mode-documents`,
    );

    const workspace = createElement('div', 'dossier-workspace');
    workspace.append(this.renderDocumentIndex(), this.renderDocumentStage());
    panel.append(workspace);
    return panel;
  }

  private renderDocumentIndex(): HTMLElement {
    const index = createElement('aside', 'dossier-index');
    index.dataset.dossierScroll = 'document-index';
    index.setAttribute('aria-label', '문서 색인');
    const documents = this.acquiredDocuments();

    for (const group of groupOrder) {
      const entries = documents.filter((document) => document.group === group);
      if (entries.length === 0) continue;
      const section = createElement('section', 'dossier-index-group');
      section.classList.add(
        `dossier-index-group--${group.toLocaleLowerCase()}`,
      );
      const heading = createElement(
        'h3',
        'dossier-index-group__title dossier-visually-hidden',
        groupLabels[group],
      );
      const tabList = createElement('div', 'dossier-document-tabs');
      tabList.setAttribute('role', 'tablist');
      tabList.setAttribute('aria-label', groupLabels[group]);

      for (const document of entries) {
        tabList.append(this.renderDocumentTab(document, documents));
      }
      section.append(heading, tabList);
      index.append(section);
    }

    index.append(this.renderDiscoverySummary());
    return index;
  }

  private renderDocumentTab(
    dossierDocument: DossierDocument,
    allDocuments: readonly DossierDocument[],
  ): HTMLButtonElement {
    const selected = dossierDocument.id === this.activeDocumentId;
    const opened = this.state.openedDocumentIds.includes(dossierDocument.id);
    const supplemental = this.isSupplementalDocument(dossierDocument.id);
    const button = createButton('dossier-document-tab', '');
    button.id = `${this.instanceId}-document-tab-${dossierDocument.id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(selected));
    button.setAttribute(
      'aria-controls',
      `${this.instanceId}-document-${dossierDocument.id}`,
    );
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle('active', selected);
    button.classList.toggle('unread', !opened);
    button.classList.toggle('read', opened);
    button.classList.toggle('supplemental', supplemental);
    button.classList.toggle('forensic', supplemental);
    button.disabled = this.status.disabled === true;

    const id = createElement(
      'span',
      'dossier-document-tab__id',
      dossierDocument.id,
    );
    const title = createElement(
      'span',
      'dossier-document-tab__title',
      dossierDocument.title,
    );
    const status = createElement('small', 'dossier-document-tab__status');
    if (supplemental) {
      const addedLabel = createElement(
        'span',
        'dossier-document-tab__added',
        opened ? '추가 기록' : '새로 추가',
      );
      status.append(
        addedLabel,
        document.createTextNode(` · ${opened ? '열람함' : '미열람'}`),
      );
    } else {
      status.textContent = opened ? '열람함' : '미열람';
    }
    button.append(id, title, status);
    button.addEventListener('click', () =>
      this.selectDocument(dossierDocument.id),
    );
    button.addEventListener('keydown', (event) => {
      const keys = ['ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const currentIndex = allDocuments.findIndex(
        (document) => document.id === dossierDocument.id,
      );
      let nextIndex = currentIndex;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = allDocuments.length - 1;
      if (event.key === 'ArrowUp') {
        nextIndex =
          (currentIndex - 1 + allDocuments.length) % allDocuments.length;
      }
      if (event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % allDocuments.length;
      }
      const nextDocument = allDocuments[nextIndex];
      if (!nextDocument) return;
      this.selectDocument(nextDocument.id);
      this.element
        .querySelector<HTMLButtonElement>(
          `#${this.instanceId}-document-tab-${nextDocument.id}`,
        )
        ?.focus();
    });
    return button;
  }

  private selectDocument(documentId: string): void {
    if (this.status.disabled) return;
    const documentExists = this.acquiredDocuments().some(
      (document) => document.id === documentId,
    );
    if (!documentExists) return;
    this.activeDocumentId = documentId;
    this.selectedQuoteId = undefined;
    this.normalizeSelection();
    this.render();
    this.resetDocumentStageScroll();
    this.activate();
    this.revealDocumentTab(documentId);
  }

  private navigateDocument(direction: -1 | 1): void {
    if (this.status.disabled || this.mode !== 'documents') return;
    const documents = this.acquiredDocuments();
    if (documents.length < 2) return;
    const currentIndex = documents.findIndex(
      (document) => document.id === this.activeDocumentId,
    );
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const next =
      documents[
        (safeIndex + direction + documents.length) % documents.length
      ];
    if (next) this.selectDocument(next.id);
  }

  private readonly handleShellKeydown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      this.status.disabled ||
      this.mode !== 'documents' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    this.navigateDocument(event.key === 'ArrowRight' ? 1 : -1);
  };

  private resetDocumentStageScroll(): void {
    const stage = this.element.querySelector<HTMLElement>(
      '[data-dossier-scroll="document-stage"]',
    );
    if (stage) stage.scrollTop = 0;
  }

  private revealDocumentTab(documentId: string): void {
    const index = this.element.querySelector<HTMLElement>('.dossier-index');
    const tab = this.element.querySelector<HTMLElement>(
      `#${this.instanceId}-document-tab-${documentId}`,
    );
    if (!index || !tab) return;

    const indexRect = index.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    if (index.scrollHeight > index.clientHeight) {
      index.scrollTop +=
        tabRect.top -
        indexRect.top -
        (index.clientHeight - tabRect.height) / 2;
    }
    if (index.scrollWidth > index.clientWidth) {
      index.scrollLeft +=
        tabRect.left -
        indexRect.left -
        (index.clientWidth - tabRect.width) / 2;
    }
  }

  private renderDiscoverySummary(): HTMLElement {
    const section = createElement('section', 'dossier-discovery-summary');
    const heading = createElement('h3', undefined, '수사 메모');
    const found = new Set(this.state.foundDiscoveryIds);
    const discoveries = this.definition.discoveries.filter((discovery) =>
      found.has(discovery.id),
    );
    const list = createElement('ul');
    if (discoveries.length === 0) {
      const empty = createElement(
        'li',
        'dossier-discovery-summary__empty',
        '문서에서 확인한 관찰 사항이 아직 없다.',
      );
      list.append(empty);
    } else {
      for (const discovery of discoveries) {
        const item = createElement('li');
        const observation = createElement(
          'span',
          undefined,
          discovery.observation,
        );
        item.append(observation);
        if (discovery.note) {
          item.append(createElement('small', undefined, discovery.note));
        }
        list.append(item);
      }
    }
    section.append(heading, list);
    return section;
  }

  private renderDocumentStage(): HTMLElement {
    const stage = createElement('main', 'dossier-document-stage');
    stage.dataset.dossierScroll = 'document-stage';
    const document = this.acquiredDocuments().find(
      (entry) => entry.id === this.activeDocumentId,
    );
    if (!document) {
      stage.append(
        createElement(
          'p',
          'dossier-empty',
          '현재 열람할 수 있는 사건 문서가 없다.',
        ),
      );
      return stage;
    }
    stage.append(this.renderDocument(document));
    return stage;
  }

  private renderDocument(dossierDocument: DossierDocument): HTMLElement {
    const supplemental = this.isSupplementalDocument(dossierDocument.id);
    const article = createElement(
      'article',
      `dossier-document dossier-document--${documentKindClass(dossierDocument.kind)}`,
    );
    article.classList.toggle('dossier-document--supplemental', supplemental);
    article.id = `${this.instanceId}-document-${dossierDocument.id}`;
    article.setAttribute('role', 'tabpanel');
    article.setAttribute(
      'aria-labelledby',
      `${this.instanceId}-document-tab-${dossierDocument.id}`,
    );

    const paper = createElement('div', 'dossier-paper');
    paper.classList.toggle('dossier-paper--supplemental', supplemental);
    const header = createElement('header', 'dossier-paper__header');
    const kind = createElement(
      'p',
      'dossier-paper__kind',
      documentKindLabels[dossierDocument.kind],
    );
    const title = createElement(
      'h3',
      'dossier-paper__title',
      dossierDocument.title,
    );
    header.append(kind, title);
    if (supplemental) {
      header.append(
        createElement(
          'span',
          'dossier-paper__added-label',
          '추가 감식 기록 · 사건 서류에 편입',
        ),
      );
    }
    if (dossierDocument.organization) {
      header.append(
        createElement(
          'p',
          'dossier-paper__organization',
          dossierDocument.organization,
        ),
      );
    }
    if (dossierDocument.documentNumber) {
      header.append(
        createElement(
          'p',
          'dossier-paper__number',
          `문서번호 ${dossierDocument.documentNumber}`,
        ),
      );
    }
    paper.append(header);

    const activePage = this.activePage(dossierDocument);
    if (dossierDocument.pages.length > 1) {
      paper.append(this.renderPageTabs(dossierDocument, activePage));
    }
    if (activePage) {
      paper.append(this.renderPage(dossierDocument, activePage));
    }

    if (
      dossierDocument.kind === 'OFFICIAL_REPORT' ||
      dossierDocument.kind === 'MEDICAL_REPORT'
    ) {
      const stamp = createElement(
        'div',
        'dossier-paper__stamp',
        dossierDocument.kind === 'MEDICAL_REPORT' ? '예비\n소견' : '접수\n완료',
      );
      stamp.setAttribute('aria-hidden', 'true');
      paper.append(stamp);
    }

    article.append(paper);
    return article;
  }

  private activePage(document: DossierDocument): DossierPage | undefined {
    const pageId = this.activePageIds.get(document.id);
    return (
      document.pages.find((page) => page.id === pageId) ?? document.pages[0]
    );
  }

  private renderPageTabs(
    document: DossierDocument,
    activePage: DossierPage | undefined,
  ): HTMLElement {
    const navigation = createElement('nav', 'dossier-page-tabs');
    navigation.setAttribute('role', 'tablist');
    navigation.setAttribute('aria-label', `${document.title} 페이지`);
    for (const [index, page] of document.pages.entries()) {
      const selected = page.id === activePage?.id;
      const button = createButton('dossier-page-tab', page.label);
      button.id = `${this.instanceId}-page-tab-${page.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute(
        'aria-controls',
        `${this.instanceId}-page-${page.id}`,
      );
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('active', selected);
      button.disabled = this.status.disabled === true;
      button.addEventListener('click', () =>
        this.selectPage(document.id, page.id),
      );
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const next =
          document.pages[
            (index + direction + document.pages.length) %
              document.pages.length
          ];
        if (!next) return;
        this.selectPage(document.id, next.id);
        this.element
          .querySelector<HTMLButtonElement>(
            `#${this.instanceId}-page-tab-${next.id}`,
          )
          ?.focus();
      });
      navigation.append(button);
    }
    return navigation;
  }

  private selectPage(documentId: string, pageId: string): void {
    if (this.status.disabled) return;
    const document = this.definition.documents.find(
      (entry) => entry.id === documentId,
    );
    if (!document?.pages.some((page) => page.id === pageId)) return;
    this.activePageIds.set(documentId, pageId);
    this.selectedQuoteId = undefined;
    this.render();
    this.resetDocumentStageScroll();
  }

  private renderPage(
    document: DossierDocument,
    page: DossierPage,
  ): HTMLElement {
    const section = createElement('section', 'dossier-page');
    section.id = `${this.instanceId}-page-${page.id}`;
    section.setAttribute('role', 'tabpanel');
    if (document.pages.length > 1) {
      section.setAttribute(
        'aria-labelledby',
        `${this.instanceId}-page-tab-${page.id}`,
      );
    } else {
      section.setAttribute('aria-label', page.label);
    }
    section.dataset.pageId = page.id;
    if (document.pages.length === 1) {
      const pageLabel = createElement(
        'p',
        'dossier-page__label',
        page.label,
      );
      section.append(pageLabel);
    }

    for (const block of page.blocks) {
      if (block.type === 'paragraph') {
        section.append(
          this.renderParagraphBlock(document.id, block),
        );
      } else if (block.type === 'fields') {
        const fieldList = createElement('dl', 'dossier-field-list');
        fieldList.dataset.blockId = block.id;
        for (const row of block.rows) {
          const rowElement = createElement('div', 'dossier-field-row');
          rowElement.dataset.sourceId = row.id;
          const found = row.discoveryId
            ? this.state.foundDiscoveryIds.includes(row.discoveryId)
            : false;
          const selected = row.quoteId === this.selectedQuoteId;
          rowElement.classList.toggle('discovered', found);
          rowElement.classList.toggle('selected', selected);
          const term = createElement('dt', undefined, row.label);
          const description = createElement('dd');
          if (row.quoteId || row.discoveryId) {
            const action = this.createSourceButton(
              document.id,
              row.id,
              row.value,
              row.quoteId,
              row.discoveryId,
              'dossier-field-action',
            );
            description.append(action);
          } else {
            description.textContent = row.value;
          }
          rowElement.append(term, description);
          if (row.discoveryId && found) {
            const note = this.renderDiscoveryNote(row.discoveryId);
            if (note) rowElement.append(note);
          }
          fieldList.append(rowElement);
        }
        section.append(fieldList);
      } else if (block.type === 'table') {
        const table = createElement('table', 'dossier-table');
        table.dataset.blockId = block.id;
        const hasActions = block.rows.some(
          (row) => row.quoteId || row.discoveryId,
        );
        const caption = createElement(
          'caption',
          'dossier-visually-hidden',
          `${document.title} 표`,
        );
        const head = createElement('thead');
        const headRow = createElement('tr');
        for (const column of block.columns) {
          const heading = createElement('th', undefined, column);
          heading.scope = 'col';
          headRow.append(heading);
        }
        if (hasActions) {
          const actionHeading = createElement('th', undefined, '확인');
          actionHeading.scope = 'col';
          actionHeading.className = 'dossier-table__action-heading';
          headRow.append(actionHeading);
        }
        head.append(headRow);
        const body = createElement('tbody');
        for (const row of block.rows) {
          const found = row.discoveryId
            ? this.state.foundDiscoveryIds.includes(row.discoveryId)
            : false;
          const selected = row.quoteId === this.selectedQuoteId;
          const tableRow = createElement('tr');
          tableRow.dataset.sourceId = row.id;
          tableRow.classList.toggle('discovered', found);
          tableRow.classList.toggle('selected', selected);
          for (let index = 0; index < block.columns.length; index += 1) {
            tableRow.append(
              createElement('td', undefined, row.cells[index] ?? ''),
            );
          }
          if (hasActions) {
            const actionCell = createElement('td', 'dossier-table__action');
            if (row.quoteId || row.discoveryId) {
              actionCell.append(
                this.createSourceButton(
                  document.id,
                  row.id,
                  row.quoteId && row.discoveryId
                    ? '인용·확인'
                    : row.quoteId
                      ? '인용'
                      : found
                        ? '확인함'
                        : '확인',
                  row.quoteId,
                  row.discoveryId,
                  'dossier-table-action',
                ),
              );
            }
            tableRow.append(actionCell);
          }
          body.append(tableRow);
          if (row.discoveryId && found) {
            const noteRow = createElement(
              'tr',
              'dossier-table__discovery',
            );
            const noteCell = createElement('td');
            noteCell.colSpan = block.columns.length + (hasActions ? 1 : 0);
            const note = this.renderDiscoveryNote(row.discoveryId);
            if (note) noteCell.append(note);
            noteRow.append(noteCell);
            body.append(noteRow);
          }
        }
        table.append(caption, head, body);
        section.append(table);
      } else if (block.type === 'photo') {
        section.append(this.renderPhotoBlock(document.id, block));
      } else {
        section.append(this.renderFloorPlanBlock(block));
      }
    }
    return section;
  }

  private renderParagraphBlock(
    documentId: string,
    block: Extract<DossierPage['blocks'][number], { type: 'paragraph' }>,
  ): HTMLElement {
    const wrapper = createElement(
      'div',
      `dossier-paragraph dossier-paragraph--${block.tone ?? 'plain'}`,
    );
    wrapper.dataset.sourceId = block.id;
    const found = block.discoveryId
      ? this.state.foundDiscoveryIds.includes(block.discoveryId)
      : false;
    const selected = block.quoteId === this.selectedQuoteId;
    wrapper.classList.toggle('discovered', found);
    wrapper.classList.toggle('selected', selected);

    if (block.quoteId || block.discoveryId) {
      wrapper.append(
        this.createSourceButton(
          documentId,
          block.id,
          block.text,
          block.quoteId,
          block.discoveryId,
          'dossier-paragraph-action',
        ),
      );
    } else {
      wrapper.append(createElement('p', undefined, block.text));
    }
    if (block.discoveryId && found) {
      const note = this.renderDiscoveryNote(block.discoveryId);
      if (note) wrapper.append(note);
    }
    return wrapper;
  }

  private createSourceButton(
    documentId: string,
    sourceId: string,
    text: string,
    quoteId: string | undefined,
    discoveryId: string | undefined,
    className: string,
  ): HTMLButtonElement {
    const button = createButton(
      `${className} dossier-source-action`,
      text,
    );
    button.dataset.sourceId = sourceId;
    if (quoteId) button.dataset.quoteId = quoteId;
    if (discoveryId) button.dataset.discoveryId = discoveryId;
    const selected = quoteId !== undefined && quoteId === this.selectedQuoteId;
    const found =
      discoveryId !== undefined &&
      this.state.foundDiscoveryIds.includes(discoveryId);
    if (quoteId) button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('quotable', quoteId !== undefined);
    button.classList.toggle('selected', selected);
    button.classList.toggle('discovered', found);
    button.disabled = this.status.disabled === true;
    const actions = [
      quoteId ? '질문에 인용할 문장 선택' : undefined,
      discoveryId ? (found ? '확인한 관찰 지점' : '관찰 지점 확인') : undefined,
    ].filter((action): action is string => action !== undefined);
    if (actions.length > 0) {
      button.setAttribute('aria-label', `${text} · ${actions.join(', ')}`);
    }
    button.addEventListener('click', () =>
      this.activateSource(documentId, quoteId, discoveryId),
    );
    return button;
  }

  private activateSource(
    documentId: string,
    quoteId: string | undefined,
    discoveryId: string | undefined,
  ): void {
    if (this.status.disabled) return;
    this.ensureDocumentOpened(documentId);
    if (quoteId) {
      this.selectedQuoteId =
        this.selectedQuoteId === quoteId ? undefined : quoteId;
    }
    if (
      discoveryId &&
      !this.state.foundDiscoveryIds.includes(discoveryId)
    ) {
      this.callbacks.onInspectDiscovery(documentId, discoveryId);
    }
    this.render();
  }

  private ensureDocumentOpened(documentId: string): void {
    if (!this.state.openedDocumentIds.includes(documentId)) {
      this.callbacks.onOpenDocument(documentId);
    }
  }

  private renderDiscoveryNote(
    discoveryId: string,
  ): HTMLElement | undefined {
    const discovery = this.definition.discoveries.find(
      (entry) => entry.id === discoveryId,
    );
    if (!discovery) return undefined;
    const note = createElement('aside', 'dossier-discovery-note');
    note.setAttribute('aria-live', 'polite');
    const label = createElement('strong', undefined, '관찰 기록');
    const observation = createElement(
      'p',
      undefined,
      discovery.observation,
    );
    note.append(label, observation);
    if (discovery.note) {
      note.append(createElement('small', undefined, discovery.note));
    }
    return note;
  }

  private renderPhotoBlock(
    documentId: string,
    block: DossierPhotoBlock,
  ): HTMLElement {
    const figure = createElement('figure', 'dossier-photo');
    figure.dataset.blockId = block.id;
    const frame = createElement('div', 'dossier-photo__frame');
    const image = createElement('img');
    image.src = block.assetPath;
    image.alt = block.alt;
    image.decoding = 'async';
    image.draggable = false;
    frame.append(image);

    const hotspotLayer = createElement(
      'div',
      'dossier-photo__hotspots',
    );
    hotspotLayer.setAttribute('aria-hidden', 'false');
    for (const [index, hotspot] of block.hotspots.entries()) {
      const found = this.state.foundDiscoveryIds.includes(
        hotspot.discoveryId,
      );
      const button = createButton(
        `dossier-photo-hotspot${found ? ' discovered' : ''}`,
        String(index + 1),
      );
      button.dataset.hotspotId = hotspot.id;
      button.setAttribute('aria-label', hotspot.label);
      button.setAttribute('aria-pressed', String(found));
      button.title = hotspot.label;
      button.disabled = this.status.disabled === true;
      setPercentRect(button, hotspot.rect);
      button.addEventListener('click', () =>
        this.inspectDiscovery(documentId, hotspot.discoveryId),
      );
      hotspotLayer.append(button);
    }
    frame.append(hotspotLayer);

    const caption = createElement(
      'figcaption',
      'dossier-photo__caption',
      block.caption,
    );
    figure.append(frame, caption);

    if (block.hotspots.length > 0) {
      const accessible = createElement(
        'section',
        'dossier-hotspot-accessibility',
      );
      const heading = createElement('h4', undefined, '사진 속 관찰 지점');
      const help = createElement(
        'p',
        undefined,
        '사진을 확대해 확인할 지점을 선택한다.',
      );
      const list = createElement('ol', 'dossier-hotspot-list');
      for (const hotspot of block.hotspots) {
        const found = this.state.foundDiscoveryIds.includes(
          hotspot.discoveryId,
        );
        const item = createElement(
          'li',
          found ? 'discovered' : undefined,
        );
        const button = createButton(
          'dossier-hotspot-list__button',
          hotspot.label,
        );
        button.setAttribute('aria-pressed', String(found));
        button.disabled = this.status.disabled === true;
        button.addEventListener('click', () =>
          this.inspectDiscovery(documentId, hotspot.discoveryId),
        );
        item.append(button);
        if (found) {
          const discovery = this.definition.discoveries.find(
            (entry) => entry.id === hotspot.discoveryId,
          );
          if (discovery) {
            item.append(
              createElement(
                'p',
                'dossier-hotspot-list__observation',
                discovery.observation,
              ),
            );
            if (discovery.note) {
              item.append(
                createElement('small', undefined, discovery.note),
              );
            }
          }
        }
        list.append(item);
      }
      accessible.append(heading, help, list);
      figure.append(accessible);
    }
    return figure;
  }

  private inspectDiscovery(
    documentId: string,
    discoveryId: string,
  ): void {
    if (
      this.status.disabled ||
      this.state.foundDiscoveryIds.includes(discoveryId)
    ) {
      return;
    }
    this.ensureDocumentOpened(documentId);
    this.callbacks.onInspectDiscovery(documentId, discoveryId);
  }

  private renderFloorPlanBlock(
    block: Extract<DossierPage['blocks'][number], { type: 'floor-plan' }>,
  ): HTMLElement {
    const figure = createElement('figure', 'dossier-floor-plan');
    figure.dataset.blockId = block.id;
    const canvas = createElement('div', 'dossier-floor-plan__canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      '극장 구역의 상대적 위치를 나타낸 평면도',
    );
    for (const zone of block.zones) {
      const room = createElement('div', 'dossier-floor-plan__zone');
      room.dataset.zoneId = zone.id;
      room.setAttribute('aria-hidden', 'true');
      setZoneRect(room, zone);
      const label = createElement('strong', undefined, zone.label);
      const detail = createElement('span', undefined, zone.detail);
      room.append(label, detail);
      canvas.append(room);
    }
    const caption = createElement(
      'figcaption',
      'dossier-floor-plan__legend',
    );
    const heading = createElement('h4', undefined, '구역 안내');
    const list = createElement('ul');
    for (const zone of block.zones) {
      const item = createElement('li');
      item.append(
        createElement('strong', undefined, zone.label),
        createElement('span', undefined, zone.detail),
      );
      list.append(item);
    }
    caption.append(heading, list);
    figure.append(canvas, caption);
    return figure;
  }

  private renderRequestsPanel(): HTMLElement {
    const panel = createElement('section', 'dossier-requests-panel');
    panel.id = `${this.instanceId}-requests-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute(
      'aria-labelledby',
      `${this.instanceId}-mode-requests`,
    );
    panel.dataset.dossierScroll = 'requests-panel';

    const used = this.state.spentForensicSlots;
    const total = this.definition.forensicSlotCount;
    const remaining = Math.max(0, total - used);
    const header = createElement('header', 'dossier-request-header');
    const copy = createElement('div');
    const eyebrow = createElement('p', 'dossier-eyebrow', '분석 자원');
    const title = createElement('h3', undefined, '감식·조회 의뢰');
    const description = createElement(
      'p',
      undefined,
      '문서와 심문에서 근거를 찾으면 새 분석 항목이 열린다. 기록 조회는 감식 슬롯을 소모하지 않는다.',
    );
    copy.append(eyebrow, title, description);
    const counter = createElement('div', 'dossier-slot-counter');
    const counterLabel = createElement(
      'span',
      undefined,
      `남은 감식 슬롯 ${remaining}`,
    );
    const counterValue = createElement(
      'strong',
      undefined,
      `${used} / ${total}`,
    );
    const meter = createElement('progress');
    meter.max = Math.max(1, total);
    meter.value = used;
    meter.setAttribute(
      'aria-label',
      `감식 슬롯 ${total}개 중 ${used}개 사용`,
    );
    counter.append(counterLabel, counterValue, meter);
    header.append(copy, counter);

    const requestList = createElement('div', 'dossier-request-list');
    for (const request of this.definition.requests) {
      requestList.append(this.renderRequest(request, remaining));
    }
    panel.append(header, requestList);
    return panel;
  }

  private renderRequest(
    request: DossierRequest,
    remainingSlots: number,
  ): HTMLElement {
    const available = this.state.availableRequestIds.includes(request.id);
    const completed = this.state.completedRequestIds.includes(request.id);
    const resultDocumentId = request.resultDocumentIds.find((documentId) =>
      this.state.acquiredDocumentIds.includes(documentId),
    );
    const canOpenResult = completed && resultDocumentId !== undefined;
    const noSlots =
      available &&
      !completed &&
      request.slotCost > 0 &&
      request.slotCost > remainingSlots;
    const card = createElement(
      'article',
      [
        'dossier-request-card',
        available ? 'available' : 'locked',
        completed ? 'completed' : '',
        noSlots ? 'no-slots' : '',
        request.privateResult ? 'private' : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    card.dataset.requestId = request.id;

    const header = createElement('header', 'dossier-request-card__header');
    const heading = createElement('h4', undefined, request.label);
    const badges = createElement('div', 'dossier-request-card__badges');
    const kind = createElement(
      'span',
      `dossier-request-kind dossier-request-kind--${request.kind.toLocaleLowerCase()}`,
      requestKindLabels[request.kind],
    );
    const cost = createElement(
      'span',
      'dossier-request-cost',
      request.slotCost > 0
        ? `슬롯 ${request.slotCost}`
        : '슬롯 미소모',
    );
    badges.append(kind, cost);
    if (request.privateResult) {
      badges.append(
        createElement(
          'span',
          'dossier-request-private',
          '비공개 결과',
        ),
      );
    }
    header.append(heading, badges);

    const description = createElement(
      'p',
      'dossier-request-card__description',
      request.description,
    );
    const status = createElement('p', 'dossier-request-card__status');
    if (completed) {
      status.textContent = resultDocumentId
        ? request.privateResult
          ? '분석 완료 · 비공개 결과 문서가 사건 서류에 추가됐다.'
          : '분석 완료 · 결과 문서가 사건 서류에 추가됐다.'
        : request.privateResult
          ? '분석 완료 · 결과는 떠보기용 수사 메모로만 보관한다.'
          : '분석 완료 · 결과가 수사 기록에 반영됐다.';
    } else if (!available) {
      status.textContent = request.lockedReason;
    } else if (noSlots) {
      status.textContent = '남은 감식 슬롯이 부족하다.';
    } else {
      status.textContent =
        request.slotCost > 0
          ? '의뢰 가능 · 선택하면 감식 슬롯을 소모한다.'
          : '조회 가능 · 감식 슬롯을 소모하지 않는다.';
    }

    const action = createButton(
      'dossier-request-action',
      canOpenResult
        ? '결과 문서 보기'
        : completed
          ? '처리 완료'
        : !available
          ? '잠김'
          : noSlots
            ? '슬롯 부족'
            : request.kind === 'FORENSIC'
              ? '감식 의뢰'
              : request.kind === 'RESTORATION'
                ? '복원 의뢰'
                : '기록 조회',
    );
    action.classList.toggle(
      'dossier-request-action--result',
      canOpenResult,
    );
    action.disabled =
      this.status.disabled === true ||
      (completed ? !canOpenResult : !available || noSlots);
    action.addEventListener('click', () => {
      if (this.status.disabled) return;
      if (canOpenResult && resultDocumentId) {
        this.openResultDocument(resultDocumentId);
        return;
      }
      if (completed) return;
      this.callbacks.onRequestAnalysis(request.id);
    });
    card.append(header, description, status, action);
    return card;
  }

  private openResultDocument(documentId: string): void {
    if (
      this.status.disabled ||
      !this.state.acquiredDocumentIds.includes(documentId)
    ) {
      return;
    }
    this.mode = 'documents';
    this.activeDocumentId = documentId;
    this.selectedQuoteId = undefined;
    this.normalizeSelection();
    this.render();
    this.resetDocumentStageScroll();
    this.activate();
    this.revealDocumentTab(documentId);
  }

  private renderQuoteToolbar(): HTMLElement {
    const toolbar = createElement('footer', 'dossier-quote-toolbar');
    const quote = this.selectedQuote();
    const quoteAttached =
      quote !== undefined && quote.id === this.status.attachedQuoteId;
    toolbar.classList.toggle('ready', quote !== undefined);
    toolbar.classList.toggle('attached', quoteAttached);
    const copy = createElement('div', 'dossier-quote-toolbar__copy');
    const label = createElement(
      'span',
      undefined,
      quote ? '선택한 문장' : '문장 인용',
    );
    const text = createElement(
      quote ? 'blockquote' : 'p',
      undefined,
      quote
        ? quote.text
        : '밑줄 가능한 문장을 선택하면 다음 질문에 인용할 수 있다.',
    );
    copy.append(label, text);

    const action = createButton(
      'dossier-quote-attach',
      quoteAttached
        ? '질문에 첨부됨'
        : '질문에 인용 첨부',
    );
    action.disabled =
      this.status.disabled === true ||
      quote === undefined ||
      quoteAttached;
    action.addEventListener('click', () => {
      if (!quote || this.status.disabled) return;
      this.ensureDocumentOpened(quote.documentId);
      this.callbacks.onAttachQuote(quote.id);
    });
    toolbar.append(copy, action);
    return toolbar;
  }

  private selectedQuote(): DossierQuote | undefined {
    return this.definition.quotes.find(
      (quote) => quote.id === this.selectedQuoteId,
    );
  }
}

export function mountDossierView(
  host: HTMLElement,
  definition: DossierDefinition,
  state: DossierState,
  callbacks: DossierViewCallbacks,
  options: DossierViewOptions = {},
): DossierView {
  return new DossierView(host, definition, state, callbacks, options);
}
