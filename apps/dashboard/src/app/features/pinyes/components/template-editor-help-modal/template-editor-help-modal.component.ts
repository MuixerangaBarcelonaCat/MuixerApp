import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  Circle,
  Building2,
  GitCommitHorizontal,
  SlidersHorizontal,
  RotateCcw,
  Keyboard,
  Search,
  X,
  ChevronDown,
} from 'lucide-angular';

const STORAGE_KEY = 'muixer_template_editor_help_dismissed';
const TAB_STORAGE_KEY = 'muixer_help_last_tab';

export interface HelpItem {
  question: string;
  answer: string;
}

export interface ShortcutItem {
  keys: string;
  action: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

export interface HelpSection {
  id: string;
  title: string;
  icon: typeof Circle;
  items: HelpItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Editor de templates',
    shortcuts: [
      { keys: 'Clic', action: 'Seleccionar node' },
      { keys: 'Doble clic', action: 'Editar etiqueta' },
      { keys: '⌘/Ctrl + C', action: 'Copiar node' },
      { keys: '⌘/Ctrl + V', action: 'Enganxar node' },
      { keys: '⌘/Ctrl + D', action: 'Duplicar node' },
      { keys: 'Supr / Backspace', action: 'Eliminar node seleccionat' },
      { keys: '↑ ↓ ← →', action: 'Moure node (1 px)' },
      { keys: 'Shift + ↑ ↓ ← →', action: 'Moure node (10 px)' },
      { keys: '⌘/Ctrl + Shift + P', action: 'Previsualitzar / sortir de previsualització' },
      { keys: 'Roda del ratolí', action: 'Zoom' },
      { keys: 'Arrossegar fons', action: 'Desplaçar canvas (pan)' },
    ],
  },
  {
    title: 'Editor de rengles',
    shortcuts: [
      { keys: 'Clic sobre nodes', action: 'Afegir a la rengla en curs' },
      { keys: 'Enter', action: 'Confirmar i desar la rengla' },
      { keys: 'Escape', action: 'Cancel·lar rengla / tancar diàleg' },
    ],
  },
  {
    title: 'Canvas d\'assignació',
    shortcuts: [
      { keys: 'Clic', action: 'Seleccionar node (per assignar)' },
      { keys: 'Arrossegar', action: 'Moure node ad-hoc' },
      { keys: 'Doble clic', action: 'Obrir propietats del node ad-hoc' },
      { keys: 'Tab', action: 'Avançar al node buit següent' },
      { keys: 'Escape', action: 'Deseleccionar / tancar panells' },
      { keys: '⌘/Ctrl + C', action: 'Copiar node ad-hoc' },
      { keys: '⌘/Ctrl + V', action: 'Enganxar node ad-hoc' },
      { keys: '⌘/Ctrl + D', action: 'Duplicar node ad-hoc' },
      { keys: 'Supr / Backspace', action: 'Eliminar node ad-hoc' },
      { keys: '↑ ↓ ← →', action: 'Moure node ad-hoc (1 px)' },
      { keys: 'Shift + ↑ ↓ ← →', action: 'Moure node ad-hoc (10 px)' },
      { keys: '⌘/Ctrl + 1…8', action: 'Crear node de pinya (preset ràpid)' },
      { keys: '⌘/Ctrl + 9', action: 'Crear node Comodí' },
    ],
  },
  {
    title: 'Projecció',
    shortcuts: [
      { keys: '← / →', action: 'Segment anterior / següent' },
      { keys: 'E', action: 'Alternar vista Pinyes / Troncs' },
      { keys: 'F', action: 'Pantalla completa del navegador' },
      { keys: 'Escape', action: 'Tancar panell / tornar enrere' },
      { keys: '? / H', action: 'Obrir / tancar ajuda' },
    ],
  },
];

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'pinya',
    title: 'Pinya',
    icon: Circle,
    items: [
      {
        question: 'Com afegeixo posicions a la pinya?',
        answer: 'Utilitza la barra d\'eines lateral per seleccionar el tipus de posició (mans, vents, laterals, agulla, crossa...) i clica al canvas per col·locar-la.',
      },
      {
        question: 'Com moc una posició?',
        answer: 'Clica i arrossega qualsevol node per reposicionar-lo al canvas. El node es mourà lliurement o farà snap a la graella si està activada.',
      },
      {
        question: 'Com redimensiono o giro un node?',
        answer: 'Selecciona un node i utilitza els controladors del Transformer (cantonades per redimensionar, part superior per girar).',
      },
      {
        question: 'Com edito l\'etiqueta d\'un node?',
        answer: 'Fes doble clic sobre un node per obrir l\'editor de text inline. Escriu el nom i prem Enter o clica fora per confirmar.',
      },
      {
        question: 'Com activo la graella (snap-to-grid)?',
        answer: 'Utilitza el botó de graella a la toolbar per activar/desactivar. La mida de la graella es pot configurar al panell de propietats.',
      },
      {
        question: 'Com faig zoom i desplaçament (pan)?',
        answer: 'Zoom: roda del ratolí. Pan: clica i arrossega el fons del canvas, o utilitza el botó central del ratolí.',
      },
      {
        question: 'Com elimino un node?',
        answer: 'Selecciona el node i prem la tecla Supr/Delete, o utilitza el botó d\'eliminar a la toolbar lateral.',
      },
    ],
  },
  {
    id: 'tronc',
    title: 'Tronc',
    icon: Building2,
    items: [
      {
        question: 'Com accedeixo al tronc?',
        answer: 'Clica el botó "Tronc" a la barra superior de l\'editor. S\'obrirà un panell flotant amb la visualització del tronc en mode editor.',
      },
      {
        question: 'Com funcionen les unitats del tronc?',
        answer: 'El tronc utilitza unitats relatives (0–8u, amb passos de 0.5). 1 unitat equival aproximadament a l\'amplada d\'una persona. La posició X indica on comença i Width quant d\'espai ocupa.',
      },
      {
        question: 'Com afegeixo un pis al tronc?',
        answer: 'Utilitza el desplegable "Afegir pis" del panell del tronc. Pots afegir qualsevol pis faltant (P2, P3, P4...) — no cal que sigui seqüencial.',
      },
      {
        question: 'Com afegeixo posicions a un pis?',
        answer: 'Dins de cada pis, clica el botó "+" per afegir una nova posició. Ajusta la posició X i l\'amplada amb els controls inline.',
      },
      {
        question: 'El tronc és compartit entre figures de la mateixa família?',
        answer: 'Sí. El tronc i les Bases s\'emmagatzemen a nivell de família. Editar el tronc en una figura actualitza automàticament totes les figures de la mateixa família.',
      },
      {
        question: 'Com canvio l\'orientació del tronc?',
        answer: 'Utilitza el toggle d\'orientació al panell del tronc per alternar entre P1 a dalt (ascendent) o P1 a baix (descendent).',
      },
    ],
  },
  {
    id: 'rengles',
    title: 'Rengles',
    icon: GitCommitHorizontal,
    items: [
      {
        question: 'Què és una rengla?',
        answer: 'Una rengla és una línia radial de posicions que va del centre de la pinya cap enfora. Cada posició dins la rengla correspon a un cordó diferent (1r, 2n, 3r...).',
      },
      {
        question: 'Com creo una rengla?',
        answer: 'Activa el mode "Edita rengles" a la toolbar. Clica seqüencialment els nodes que formen la línia radial (del centre cap enfora) i confirma amb Enter.',
      },
      {
        question: 'Què és el Ghost Clone?',
        answer: 'Darrere de cada node de pinya (excepte centrals i cordó obert) apareix un "+" fantasma. Clicant-lo es crea un clon alineat radialment i s\'afegeix automàticament a la mateixa rengla.',
      },
      {
        question: 'Com es crea una rengla?',
        answer: 'Activeu el mode rengles, cliqueu els nodes en ordre (del centre cap enfora) i premeu "Finalitzar". La rengla es crea automàticament sense cap formulari.',
      },
      {
        question: 'Puc eliminar una rengla?',
        answer: 'Sí. Eliminar una rengla no elimina els nodes — només els desassigna de la rengla (renglaId = null). Els nodes queden al canvas com a lliures.',
      },
      {
        question: 'Què passa si un node no té rengla?',
        answer: 'Nodes sense rengla (agulla, crossa, contrafort, tap) sempre es mostren independentment del nombre de cordons seleccionat a l\'assignació.',
      },
    ],
  },
  {
    id: 'cordons',
    title: 'Cordons',
    icon: SlidersHorizontal,
    items: [
      {
        question: 'Com funciona el selector de cordons?',
        answer: 'A l\'assignació, el botó "Cordons" obre un diàleg on tries quants cordons mostrar. Només es veuen les posicions amb renglaPosition ≤ numberOfCordons.',
      },
      {
        question: 'Què és el cordó obert?',
        answer: 'El cordó obert és una posició extra al final d\'una rengla per a la persona que vigila la figura des de fora. S\'activa per rengla des del selector de cordons.',
      },
      {
        question: 'Canviar cordons afecta les assignacions?',
        answer: 'No. Amagar cordons només oculta visualment les posicions. Les assignacions existents es mantenen intactes i reapareixen en tornar a mostrar el cordó.',
      },
      {
        question: 'La configuració de cordons es guarda?',
        answer: 'Sí. La configuració (numberOfCordons i openCordons) es desa a la instància i persisteix entre sessions.',
      },
    ],
  },
  {
    id: 'bases',
    title: 'Bases',
    icon: RotateCcw,
    items: [
      {
        question: 'Quin ordre han de tenir les Bases?',
        answer: 'Les Bases es numeren en sentit anti-horari (CCW) partint de la dalt-esquerra: Base 1 = dalt-esquerra, Base 2 = baix-esquerra, Base 3 = baix-dreta, Base 4 = dalt-dreta.',
      },
      {
        question: 'Per què importa l\'ordre de les Bases?',
        answer: 'L\'ordre de les Bases determina quina persona del Tronc queda alineada sobre quina Base. Si estan desordenades, els Segons, Terços i altres posicions del Tronc es col·loquen malament.',
      },
      {
        question: 'Què significa "Bases desordenades"?',
        answer: 'Quan la validació detecta que les Bases no segueixen l\'ordre anti-horari correcte, apareix un avís al llistat de famílies i a l\'editor.',
      },
      {
        question: 'Com corregeixo l\'ordre?',
        answer: 'A l\'editor, mou les Bases perquè segueixin l\'ordre CCW (dalt-esquerra → baix-esquerra → baix-dreta → dalt-dreta). Canvia el sortOrder si cal.',
      },
    ],
  },
  {
    id: 'dreceres',
    title: 'Dreceres',
    icon: Keyboard,
    items: [
      {
        question: 'Dreceres de selecció i edició (editor)',
        answer: 'Clic: seleccionar node. Doble clic: editar etiqueta. Supr/Backspace: eliminar node seleccionat. ⌘/Ctrl+C: copiar node. ⌘/Ctrl+V: enganxar node.',
      },
      {
        question: 'Dreceres de moviment (editor)',
        answer: '↑ ↓ ← →: moure node 1px. Shift + ↑ ↓ ← →: moure node 10px. Arrossegar: moure lliurement. Roda del ratolí: zoom. Arrossegar fons / clic mig: desplaçar canvas (pan).',
      },
      {
        question: 'Dreceres de l\'editor de rengles',
        answer: 'Clic sobre nodes: afegir-los a la rengla en curs. Enter: confirmar i desar la rengla. Escape: cancel·lar la rengla en curs o tancar el diàleg.',
      },
      {
        question: 'Dreceres del canvas d\'assignació',
        answer: 'Tab: avançar al node buit següent (circular). Escape: deseleccionar node i persona.',
      },
      {
        question: 'Dreceres de la projecció',
        answer: '← / →: segment anterior/següent. E: alternar vista Pinyes/Troncs. F: pantalla completa del navegador. Escape: tancar panell / tornar enrere. ? o H: obrir/tancar ajuda.',
      },
    ],
  },
];

@Component({
  selector: 'app-template-editor-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './template-editor-help-modal.component.html',
})
export class TemplateEditorHelpModalComponent implements OnInit {
  readonly closed = output<void>();
  readonly autoShow = input(true);

  readonly Search = Search;
  readonly X = X;
  readonly ChevronDown = ChevronDown;

  readonly sections = HELP_SECTIONS;
  readonly shortcutGroups = SHORTCUT_GROUPS;
  readonly activeTab = signal<string>(HELP_SECTIONS[0].id);
  readonly searchQuery = signal('');
  readonly visible = signal(false);
  readonly expandedItems = signal<Set<string>>(new Set());

  readonly filteredSections = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.sections;

    return this.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.items.length > 0);
  });

  readonly activeSection = computed(() => {
    const filtered = this.filteredSections();
    const tab = this.activeTab();
    return filtered.find((s) => s.id === tab) ?? filtered[0] ?? null;
  });

  readonly hasResults = computed(() => this.filteredSections().length > 0);

  ngOnInit(): void {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== 'true' && this.autoShow()) {
      this.visible.set(true);
    }
    const lastTab = localStorage.getItem(TAB_STORAGE_KEY);
    if (lastTab && this.sections.some((s) => s.id === lastTab)) {
      this.activeTab.set(lastTab);
    }
  }

  open(): void {
    this.searchQuery.set('');
    this.expandedItems.set(new Set());
    this.visible.set(true);
  }

  close(): void {
    localStorage.setItem(STORAGE_KEY, 'true');
    this.visible.set(false);
    this.closed.emit();
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    localStorage.setItem(TAB_STORAGE_KEY, tabId);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  toggleItem(sectionId: string, index: number): void {
    const key = `${sectionId}-${index}`;
    this.expandedItems.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isItemExpanded(sectionId: string, index: number): boolean {
    return this.expandedItems().has(`${sectionId}-${index}`);
  }

  getSectionIcon(section: HelpSection) {
    return section.icon;
  }

  isSearching(): boolean {
    return this.searchQuery().trim().length > 0;
  }
}
