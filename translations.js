const TRANSLATIONS = {
  es: {
    // HUD
    'hud.speed':               'Velocidad',
    'hud.heading':             'Rumbo',
    'hud.wind_speed':          'Viento',
    'hud.wind_from':           'De',

    // Mainsheet controller states
    'trim.eased':              'FILADA',
    'trim.easing':             'FILANDO…',
    'trim.trimmed':            'CAZADA',
    'trim.stalled':            'PARADA',
    'trim.luffing':            'FLAMEA',

    // Helm controller
    'helm.port':               'BABOR',
    'helm.starboard':          'ESTRIBOR',

    // Map names
    'map.buoy1.name':          'Una Boya',
    'map.buoy2.name':          'Dos Boyas',
    'map.triangle.name':       'Triángulo Olímpico',
    'map.dock.name':           'Muelle',
    'map.dock.label':          'Marina',

    // Map objectives
    'map.buoy1.objective':     'Rodea la boya #1 y regresa al punto de partida.',
    'map.buoy2.objective':     'Navega entre las boyas #1 y #2 alternando ceñida y empopada.',
    'map.triangle.objective':  'Recorrido olímpico: boya #1 → #2 → #3 → largada.',
    'map.dock.objective':      'Atraca en el muelle con velocidad menor a 1 nudo.',

    // Main menu
    'menu.title':              'Martiny Boat Sailing',
    'menu.start':              'Salir a Navegar',
    'menu.settings':           'Configuración',
    'menu.select_map':         'Elige un mapa',

    // Settings panel
    'settings.title':          'Configuración',
    'settings.wind_dir':       'Dirección del viento',
    'settings.wind_speed':     'Velocidad del viento',
    'settings.wind_var':       'Variabilidad del viento',
    'settings.trim_guide':     'Mostrar guía de escota',
    'settings.no_go_arc':      'Mostrar zona muerta',
    'settings.wind_arrows':    'Flechas de viento en el agua',
    'settings.language':       'Idioma',
    'settings.layout':         'Disposición de controles',
    'settings.customize':      'Personalizar disposición',
    'settings.opacity':        'Opacidad de controles',
    'settings.notifications':  'Mostrar notificaciones',
    'settings.tab_game':       'Juego',
    'settings.tab_sound':      'Sonido',
    'settings.vol_master':     'Volumen general',
    'settings.vol_water':      'Agua',
    'settings.vol_luff':       'Vela (garruchos)',
    'settings.vol_effects':    'Efectos',

    // Pause
    'pause.title':             'Pausa',
    'pause.resume':            'Continuar',
    'pause.restart':           'Reiniciar',
    'pause.menu':              'Volver al menú',

    // Objective completion
    'complete.title':          '¡Completado!',
    'complete.back':           'Volver al menú',

    // Learning aids
    'aid.no_go':               'Zona muerta',
    'aid.trim_guide':          'Guía de escota',
    'aid.awa_label':           'AV Aparente',

    // Layout customize mode
    'layout.mode_banner':      'Arrastrá los controles a donde te quede más cómodo',
    'layout.done':             'Listo',

    // Confirm dialogs
    'confirm.yes':             'Sí',
    'confirm.no':              'Cancelar',
    'confirm.restart_msg':     '¿Reiniciar desde el principio?',
    'confirm.exit_msg':        '¿Salir al menú? Se perderá el progreso.',

    // Notifications — contextual
    'notif.trim_close':        'Casi en punto — ajustá un poco más',
    'notif.trim_perfect':      '¡Vela en punto!',
    'notif.luffing_tip':       'La vela flamea — girá para salir de la zona muerta',
    'notif.irons_tip':         'Proa al viento: filá la escota y da el timón a un lado',
    'notif.tack_success':      'Virada',
    'notif.jibe_success':      'Virada por popa',
    'notif.approach_dock':     'Reducí velocidad para atracar',
    'notif.running_warn':      'Cuidado — riesgo de virada involuntaria',

    // Idle tips
    'tip.indicators':          '¿Sabías? Activá Indicadores para ver los vectores físicos del barco',
    'tip.displacement':        '¿Sabías? Cambiá el desplazamiento en Configuración para practicar con distintas inercias',
    'tip.wind_dir':            '¿Sabías? Podés cambiar la dirección del viento para practicar distintas ceñidas',
    'tip.maps':                '¿Sabías? Hay 4 mapas — probá el Muelle para practicar atraco',
    'tip.trim_guide':          '¿Sabías? Activá la Guía de Escota para ver la posición ideal de la botabara',
    'tip.tutorial_replay':     '¿Sabías? Podés repetir el tutorial desde Configuración',
    'tip.minimap':             '¿Sabías? Activá el minimapa en Indicadores para ver el recorrido completo',

    // Mini-map
    'indicators.minimap':      'Minimapa',

    // Stuck in irons
    'irons.label':             'PROA AL VIENTO',

    // Points of sail
    'pos.in_irons':            'Proa al Viento',
    'pos.close_hauled':        'Ceñida',
    'pos.close_reach':         'Descuartelar',
    'pos.beam_reach':          'Través',
    'pos.broad_reach':         'Largo',
    'pos.running':             'Empopada',

    // Objective / buoy events
    'objective.buoy_rounded':  '¡Boya!',
    'objective.return_start':  'Regresá a la largada',

    // Failure
    'fail.title':              'MISIÓN FALLIDA',
    'fail.restart':            'Reiniciar misión',
    'fail.hit_buoy':           'Chocaste con una boya',
    'fail.hit_island':         'Encallaste en una isla',
    'fail.hit_dock':           'Llegaste al muelle demasiado rápido',
    'fail.objective_was':      'Objetivo',

    // Tutorial
    'tutorial.wind':           'Esta flecha muestra de dónde viene el viento.',
    'tutorial.mainsheet':      'Cazá el cabo para tensar la vela. Filalo para soltarla.',
    'tutorial.helm':           'Mové la caña de lado a lado para maniobrar el barco. Caña a babor → barco a estribor, y viceversa.',
    'tutorial.no_go':          'No podés navegar directo contra el viento. Apuntá a un lado.',
    'tutorial.start':          '¡Buen viento!',
    'tutorial.next':           'Continuar',
    'tutorial.skip':           'Saltear',
    'tutorial.replay':         'Ver tutorial',

    // Visual Indicators Panel
    'indicators.button_label': 'Indicadores',
    'indicators.panel_title':  'Indicadores Visuales',
    'indicators.wind_vector':  'Vector de viento',
    'indicators.heading':      'Dirección de crujía',
    'indicators.velocity':     'Vector de velocidad',
    'indicators.inertia':      'Inercia del barco',
    'indicators.displacement': 'Desplazamiento',
    'indicators.disp_light':   'Ligero',
    'indicators.disp_medium':  'Medio',
    'indicators.disp_heavy':   'Pesado',
    'indicators.target_speed': 'Vel. objetivo',
    'indicators.current_speed':'Vel. actual',

    // Layout panel row labels
    'layout.helm_row':         'Timón',
    'layout.ms_row':           'Escota',
  },

  en: {
    // HUD
    'hud.speed':               'Speed',
    'hud.heading':             'Heading',
    'hud.wind_speed':          'Wind',
    'hud.wind_from':           'From',

    // Mainsheet controller states
    'trim.eased':              'EASED',
    'trim.easing':             'EASING…',
    'trim.trimmed':            'TRIMMED',
    'trim.stalled':            'STALLED',
    'trim.luffing':            'LUFFING',

    // Helm controller
    'helm.port':               'PORT',
    'helm.starboard':          'STBD',

    // Map names
    'map.buoy1.name':          'Single Buoy',
    'map.buoy2.name':          'Two Buoys',
    'map.triangle.name':       'Olympic Triangle',
    'map.dock.name':           'Island Marina',
    'map.dock.label':          'Marina',

    // Map objectives
    'map.buoy1.objective':     'Round buoy #1 and return to the start.',
    'map.buoy2.objective':     'Sail between buoys #1 and #2, alternating upwind and downwind legs.',
    'map.triangle.objective':  'Olympic course: buoy #1 → #2 → #3 → start.',
    'map.dock.objective':      'Dock at the marina at less than 1 knot.',

    // Main menu
    'menu.title':              'Martiny Boat Sailing',
    'menu.start':              'Start Sailing',
    'menu.settings':           'Settings',
    'menu.select_map':         'Select a map',

    // Settings panel
    'settings.title':          'Settings',
    'settings.wind_dir':       'Wind direction',
    'settings.wind_speed':     'Wind speed',
    'settings.wind_var':       'Wind variability',
    'settings.trim_guide':     'Show trim guide',
    'settings.no_go_arc':      'Show no-go zone',
    'settings.wind_arrows':    'Wind arrows on water',
    'settings.language':       'Language',
    'settings.layout':         'Controller layout',
    'settings.customize':      'Customize layout',
    'settings.opacity':        'Controller opacity',
    'settings.notifications':  'Show notifications',
    'settings.tab_game':       'Game',
    'settings.tab_sound':      'Sound',
    'settings.vol_master':     'Master volume',
    'settings.vol_water':      'Water',
    'settings.vol_luff':       'Sail (hanks)',
    'settings.vol_effects':    'Effects',

    // Pause
    'pause.title':             'Paused',
    'pause.resume':            'Resume',
    'pause.restart':           'Restart',
    'pause.menu':              'Back to Menu',

    // Objective completion
    'complete.title':          'Completed!',
    'complete.back':           'Back to Menu',

    // Learning aids
    'aid.no_go':               'No-go zone',
    'aid.trim_guide':          'Trim guide',
    'aid.awa_label':           'App. Wind',

    // Layout customize mode
    'layout.mode_banner':      'Drag the controllers to wherever feels comfortable',
    'layout.done':             'Done',

    // Confirm dialogs
    'confirm.yes':             'Yes',
    'confirm.no':              'Cancel',
    'confirm.restart_msg':     'Restart from the beginning?',
    'confirm.exit_msg':        'Exit to menu? Current progress will be lost.',

    // Notifications — contextual
    'notif.trim_close':        'Almost there — trim a little more',
    'notif.trim_perfect':      'Perfect trim!',
    'notif.luffing_tip':       'Sail is luffing — turn away from the wind',
    'notif.irons_tip':         'In irons: ease sail and apply helm to one side',
    'notif.tack_success':      'Tacked',
    'notif.jibe_success':      'Jibed',
    'notif.approach_dock':     'Reduce speed to dock',
    'notif.running_warn':      'Caution — accidental jibe risk',

    // Idle tips
    'tip.indicators':          "Did you know? Enable Indicators to see the boat's physics vectors",
    'tip.displacement':        'Did you know? Change displacement in Settings to practice with different inertia',
    'tip.wind_dir':            'Did you know? You can change wind direction to practice different tacks',
    'tip.maps':                'Did you know? There are 4 maps — try the Marina map to practice docking',
    'tip.trim_guide':          'Did you know? Enable Trim Guide to see the ideal boom position',
    'tip.tutorial_replay':     'Did you know? You can replay the tutorial from Settings',
    'tip.minimap':             'Did you know? Enable the mini-map in Indicators to see the full course',

    // Mini-map
    'indicators.minimap':      'Mini-map',

    // Stuck in irons
    'irons.label':             'IN IRONS',

    // Points of sail
    'pos.in_irons':            'In Irons',
    'pos.close_hauled':        'Close-hauled',
    'pos.close_reach':         'Close Reach',
    'pos.beam_reach':          'Beam Reach',
    'pos.broad_reach':         'Broad Reach',
    'pos.running':             'Running',

    // Objective / buoy events
    'objective.buoy_rounded':  'Buoy!',
    'objective.return_start':  'Return to start',

    // Failure
    'fail.title':              'MISSION FAILED',
    'fail.restart':            'Restart mission',
    'fail.hit_buoy':           'You crashed into a buoy',
    'fail.hit_island':         'You ran aground on an island',
    'fail.hit_dock':           'You crashed into the dock too fast',
    'fail.objective_was':      'Objective',

    // Tutorial
    'tutorial.wind':           'This arrow shows where the wind is coming from.',
    'tutorial.mainsheet':      'Pull the rope to trim your sail. Ease it to release.',
    'tutorial.helm':           'Move the tiller side to side to steer the boat. Tiller to port → boat turns starboard, and vice versa.',
    'tutorial.no_go':          'You cannot sail directly into the wind. Aim to one side.',
    'tutorial.start':          'Good luck. Set sail!',
    'tutorial.next':           'Continue',
    'tutorial.skip':           'Skip',
    'tutorial.replay':         'View tutorial',

    // Visual Indicators Panel
    'indicators.button_label': 'Indicators',
    'indicators.panel_title':  'Visual Indicators',
    'indicators.wind_vector':  'Wind vector',
    'indicators.heading':      'Heading vector (keel line)',
    'indicators.velocity':     'Velocity vector',
    'indicators.inertia':      'Boat inertia',
    'indicators.displacement': 'Displacement',
    'indicators.disp_light':   'Light',
    'indicators.disp_medium':  'Medium',
    'indicators.disp_heavy':   'Heavy',
    'indicators.target_speed': 'Target speed',
    'indicators.current_speed':'Current speed',

    // Layout panel row labels
    'layout.helm_row':         'Helm',
    'layout.ms_row':           'Sail',
  },
};

let _currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('sailsim_lang')) || 'es';

function t(key) {
  return (TRANSLATIONS[_currentLang] && TRANSLATIONS[_currentLang][key])
      ?? (TRANSLATIONS['en'] && TRANSLATIONS['en'][key])
      ?? key;
}

function setLanguage(lang) {
  _currentLang = lang;
  if (typeof localStorage !== 'undefined') localStorage.setItem('sailsim_lang', lang);
  if (typeof window !== 'undefined' && window._phaserGame) {
    window._phaserGame.events.emit('lang-changed');
  }
}

function getCurrentLang() { return _currentLang; }
