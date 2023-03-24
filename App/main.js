// Welcome to main.js, where we set up the SineRider engine basics

const stepping = false

// Core constants

const ui = {
  menuBar: $('#menu-bar'),
  editButton: $('#edit-button'),
  levelText: $('#level-text'),
  levelButton: $('#level-button'),
  levelButtonString: $('#level-button > .string'),
  resetButton: $('#reset-button'),

  tryAgainButton: $('#try-again-button'),

  veil: $('#veil'),
  loadingVeil: $('#loading-veil'),
  loadingVeilString: $('#loading-string'),

  bubblets: $('.bubblets'),

  topBar: $('#top-bar'),
  navigatorButton: $('#navigator-button'),

  victoryBar: $('#victory-bar'),
  victoryLabel: $('#victory-label'),
  victoryLabelString: $('#victory-label > .string'),
  nextButton: $('#next-button'),

  messageBar: $('#message-bar'),
  messageBarString: $('#message-bar > .string'),

  variablesBar: $('#variables-bar'),
  timeString: $('#time-string'),
  completionTime: $('#completion-time'),
  controlBar: $('#controls-bar'),
  expressionText: $('#expression-text'),
  expressionEnvelope: $('#expression-envelope'),

  mathFieldLabel: $('#variable-label > .string'),
  _mathField: $('#math-field'),
  mathField: $('#math-field'),
  mathFieldStatic: $('#math-field-static'),

  dottedMathContainer: $('#dotted-math-container'),
  dottedMathFieldStatic: $('#dotted-math-field-static'),
  dottedMathField: $('#dotted-math-field-static'),
  dottedSlider: $('#dotted-slider'),
  dottedHintButton: $('#dotted-math-button'),

  volumeSlider: $('#volume-slider'),

  variableLabel: $('#variable-label'),

  runButton: $('#run-button'),
  runButtonString: $('#run-button > .string'),
  stopButton: $('#stop-button'),
  stopButtonString: $('#stop-button > .string'),

  navigatorFloatingBar: $('#navigator-floating-bar'),
  showAllButton: $('#show-all-button'),

  editorInspector: {
    editorInspector: $('#editor-inspector'),
    order: $('#editor-order-input'),
    timer: $('#editor-timer-input'),
    x: $('#editor-x-input'),
    y: $('#editor-y-input'),
    deleteSelection: $('#editor-inspector-delete'),
  },

  editorSpawner: {
    editorSpawner: $('#editor-spawner'),
    addFixed: $('#editor-spawner-fixed'),
    addDynamic: $('#editor-spawner-dynamic'),
    addPath: $('#editor-spawner-path'),
  },
  levelInfoDiv: $('#lvl-debug-info'),
  levelInfoNameStr: $('#lvl_name_str'),
  levelInfoNickStr: $('#lvl_nick_str'),
  hideLevelInfoButton: $('#button-hide-level-info'),
}

const editor = Editor(ui)

ui.levelText.setAttribute('hide', true)
ui.veil.setAttribute('hide', true)

const canvas = $('#canvas')

let canvasIsDirty = true

// NOTE: 30 ticks per second is "normal", manipulating this value changes the simulation speed, but it maintains
// deterministic results regardless
const ticksPerSecond = 30 //* 100 // (run 100x faster than normal)

// NOTE - this is very consciously decoupled from 'ticksPerSecond' so that we can get consistent results
// when modifying the # of ticks per second to be faster than normal (for instance, when we're scoring)
// This value is used by many internal tick handlers, mainly (as far as I can tell) to know how fast entities 
// should move per tick, and probably should be renamed to something like 'tickMoveDistanceMultiplier' or 
// something similar
const tickDelta = 1.0 / 30.0

const screen = Screen({
  canvas,
})

let w = worldData[0]

// const DEBUG_LEVEL = 'Level Editor'
// const DEBUG_LEVEL = 'Volcano'
// const DEBUG_LEVEL = 'Constant Lake'
// const DEBUG_LEVEL = 'Two Below'
const DEBUG_LEVEL = null

if (DEBUG_LEVEL) {
  // make debug level first level for testing
  const debugLevelIndex = w.levelData.findIndex((l) => l.name === DEBUG_LEVEL)
  if (debugLevelIndex == -1)
    alert(`DEBUG: Unable to find level '${DEBUG_LEVEL}'`)
  const tmp = w.levelData[0]
  w.levelData[0] = w.levelData[debugLevelIndex]
  w.levelData[debugLevelIndex] = tmp
}

// Don't show debug info in production
if (window.location.hostname === 'sinerider.com')
  ui.levelInfoDiv.setAttribute('hide', true)

const world = World({
  ui,
  screen,
  requestDraw,
  tickDelta,
  drawOrder: NINF,
  ...worldData[0],
})

// Core methods

function tick() {
  world.awake()
  world.start()

  world.sendEvent('tick')
}

function draw() {
  if (!canvasIsDirty) return
  canvasIsDirty = false

  // Draw order bug where Shader entity isn't actually
  // sorted in World draw array and needs another sort call
  // in order to work? Temp fix (TODO: Fix this)
  world.sortDrawArray()

  let entity
  for (let i = 0; i < world.activeDrawArray.length; i++) {
    entity = world.activeDrawArray[i]
    if (entity.draw) {
      screen.ctx.save()
      if (entity.predraw) entity.predraw()
      entity.draw()
      screen.ctx.restore()
    }
  }
}

function requestDraw() {
  if (!canvasIsDirty) {
    canvasIsDirty = true
    requestAnimationFrame(draw)
  }
}

tick()
draw()

if (!stepping) {
  setInterval(tick, 1000 / ticksPerSecond)
}

// Draw as fast as we possibly can
setInterval(requestDraw, 0)

// MathQuill

ui.mathFieldStatic = MQ.StaticMath(ui.mathFieldStatic)

function createMathField(field, eventNameOnEdit) {
  field = MQ.MathField(field, {
    handlers: {
      edit: function () {
        const text = field.getPlainExpression()
        const latex = field.latex()
        world.level.sendEvent(eventNameOnEdit, [text, latex])
      },
    },
  })

  field.getPlainExpression = function () {
    var tex = field.latex()
    return mathquillToMathJS(tex)
  }

  return field
}

ui.mathField = createMathField(ui.mathField, 'setGraphExpression')
ui.mathField.focused = () => ui._mathField.classList.contains('mq-focused')

ui.dottedMathFieldStatic = MQ.StaticMath(ui.dottedMathFieldStatic)

function onMathFieldFocus(event) {
  world.onMathFieldFocus()
}

ui.expressionEnvelope.addEventListener('focusin', onMathFieldFocus)

function onMathFieldBlur(event) {
  world.onMathFieldBlur()
}

ui.expressionEnvelope.addEventListener('blurout', onMathFieldBlur)

// HTML events

function onKeyUp(event) {
  if (event.keyCode === 13) {
    if (!world.navigating) world.toggleRunning()
  }
}

window.addEventListener('keydown', (event) => {
  if (ui.mathField.focused()) return
  world.level.sendEvent('keydown', [event.key])
})

window.addEventListener('keyup', onKeyUp)

function onExpressionTextChanged(event) {
  world.level.sendEvent('setGraphExpression', [ui.expressionText.value])
}

function setGlobalVolumeLevel(i) {
  Howler.volume(i)
  window.localStorage.setItem('volume', i)
}

function onSetVolume(event) {
  let volume = event.target.value / 100
  setGlobalVolumeLevel(volume)
}

ui.volumeSlider.addEventListener('change', onSetVolume)
ui.volumeSlider.addEventListener('mouseup', onSetVolume)
ui.volumeSlider.addEventListener('input', onSetVolume)

function onClickHint() {
  ui.dottedHintButton.style.display = 'none'

  ui.dottedSlider.hidden = false
  ui.dottedSlider.style.innerHeight = '200px'
  ui.dottedMathField.style.display = 'block'

  world.level.sendEvent('displayDottedGraph')
}

ui.dottedHintButton.addEventListener('click', onClickHint)

// Initial page state
{
  let volume = window.localStorage.getItem('volume')
  if (volume) {
    setGlobalVolumeLevel(window.localStorage)
    ui.volumeSlider.value = volume * 100
  }
}
setGlobalVolumeLevel(ui.volumeSlider.value / 100)

function onClickMapButton(event) {
  world.onClickMapButton()
  requestDraw()
}

ui.levelButton.addEventListener('click', onClickMapButton)
ui.navigatorButton.addEventListener('click', onClickMapButton)

function onClickNextButton(event) {
  world.onClickNextButton()
}

ui.nextButton.addEventListener('click', onClickNextButton)

function onClickRunButton(event) {
  if (!world.level?.isRunningAsCutscene && !world.navigating)
    world.toggleRunning()

  return true
}

// TODO: Encapsulate run/stop/victory button behavior (Entity?)
ui.runButton.addEventListener('click', onClickRunButton)
ui.stopButton.addEventListener('click', onClickRunButton)
ui.tryAgainButton.addEventListener('click', onClickRunButton)

function onClickShowAllButton(event) {
  world.navigator.showAll = !world.navigator.showAll
}

ui.showAllButton.addEventListener('click', onClickShowAllButton)

function onClickEditButton(event) {
  world.editing = !world.editing
}

ui.editButton.addEventListener('click', onClickEditButton)

function onClickResetButton(event) {
  world.onClickResetButton()
}

ui.resetButton.addEventListener('click', onClickResetButton)

function onResizeWindow(event) {
  world.sendEvent('resize', [window.innerWidth, window.innerHeight])
  screen.resize()
  canvasIsDirty = true
  draw()
}

window.addEventListener('resize', onResizeWindow)

function onClickCanvas() {
  if (stepping) {
    tick()
  }
}

canvas.addEventListener('click', onClickCanvas)
ui.veil.addEventListener('click', onClickCanvas)

function onMouseMoveCanvas(event) {
  world.clickableContext.processEvent(event, 'mouseMove')
  event.preventDefault()
}

canvas.addEventListener('mousemove', onMouseMoveCanvas)
canvas.addEventListener('pointermove', onMouseMoveCanvas)

function onMouseDownCanvas(event) {
  world.clickableContext.processEvent(event, 'mouseDown')
  event.preventDefault()
  ui.mathField.blur()
}

canvas.addEventListener('mousedown', onMouseDownCanvas)
canvas.addEventListener('pointerdown', onMouseDownCanvas)

function onMouseUpCanvas(event) {
  world.clickableContext.processEvent(event, 'mouseUp')
  event.preventDefault()
}

canvas.addEventListener('mouseup', onMouseUpCanvas)
canvas.addEventListener('pointerup', onMouseUpCanvas)

ui.levelInfoDiv.addEventListener('mouseover', function () {
  console.log('mouseover')
  ui.hideLevelInfoButton.setAttribute('hide', false)
})

ui.levelInfoDiv.addEventListener('mouseleave', function () {
  console.log('mouseleave')
  ui.hideLevelInfoButton.setAttribute('hide', true)
})
