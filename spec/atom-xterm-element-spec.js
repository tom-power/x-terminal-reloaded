/** @babel */
/*
 * Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Copyright 2017-2018 Andres Mejia <amejia004@gmail.com>. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as nodePty from 'node-pty-prebuilt'
import { shell } from 'electron'

import * as config from '../lib/atom-xterm-config'
import AtomXtermElement from '../lib/atom-xterm-element'
import AtomXtermModel from '../lib/atom-xterm-model'

import path from 'path'

import tmp from 'tmp'
import { URL, URLSearchParams } from 'whatwg-url'

describe('AtomXtermElement', () => {
  const savedPlatform = process.platform
  this.element = null
  this.tmpdirObj = null

  let createNewElement = (uri = 'atom-xterm://somesessionid/') => {
    return new Promise((resolve, reject) => {
      let terminalsSet = new Set()
      let model = new AtomXtermModel({
        uri: uri,
        terminals_set: terminalsSet
      })
      model.initializedPromise.then(() => {
        model.pane = jasmine.createSpyObj('pane',
          ['removeItem', 'getActiveItem', 'destroyItem'])
        let element = new AtomXtermElement()
        element.initialize(model).then(() => {
          resolve(element)
        })
      })
    })
  }

  beforeEach((done) => {
    atom.config.clear()
    atom.project.setPaths([])
    let ptyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    ptyProcess.process = jasmine.createSpy('process')
      .and.returnValue('sometestprocess')
    spyOn(nodePty, 'spawn').and.returnValue(ptyProcess)
    spyOn(shell, 'openExternal')
    createNewElement().then((element) => {
      this.element = element
      tmp.dir({'unsafeCleanup': true}, (err, path, cleanupCallback) => {
        if (err) {
          throw err
        }
        this.tmpdir = path
        this.tmpdirCleanupCallback = cleanupCallback
        done()
      })
    })
  })

  afterEach(() => {
    this.element.destroy()
    Object.defineProperty(process, 'platform', {
      'value': savedPlatform
    })
    this.tmpdirCleanupCallback()
    atom.config.clear()
  })

  it('initialize(model)', () => {
    // Simply test if the terminal has been created.
    expect(this.element.terminal).toBeTruthy()
  })

  it('initialize(model) check session-id', () => {
    expect(this.element.getAttribute('session-id')).toBe('somesessionid')
  })

  it('destroy() check ptyProcess killed', () => {
    this.element.destroy()
    expect(this.element.ptyProcess.kill).toHaveBeenCalled()
  })

  it('destroy() check terminal destroyed', () => {
    spyOn(this.element.terminal, 'destroy').and.callThrough()
    this.element.destroy()
    expect(this.element.terminal.destroy).toHaveBeenCalled()
  })

  it('destroy() check disposables disposed', () => {
    spyOn(this.element.disposables, 'dispose').and.callThrough()
    this.element.destroy()
    expect(this.element.disposables.dispose).toHaveBeenCalled()
  })

  it('getShellCommand()', () => {
    expect(this.element.getShellCommand()).toBe(config.getDefaultShellCommand())
  })

  it('getShellCommand() command set in uri', (done) => {
    let expected = 'somecommand'
    let params = new URLSearchParams({'command': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getShellCommand()).toBe(expected)
      done()
    })
  })

  it('getArgs()', () => {
    expect(this.element.getArgs()).toEqual([])
  })

  it('getArgs() args set in uri', (done) => {
    let expected = ['some', 'extra', 'args']
    let params = new URLSearchParams({'args': JSON.stringify(expected)})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getArgs()).toEqual(expected)
      done()
    })
  })

  it('getArgs() throw exception when args is not an array', () => {
    this.element.model.profile.args = {}
    expect(() => { this.element.getArgs() }).toThrow(new Error('Arguments set are not an array.'))
  })

  it('getTermType()', () => {
    expect(this.element.getTermType()).toBe(config.getDefaultTermType())
  })

  it('getTermType() name set in uri', (done) => {
    let expected = 'sometermtype'
    let params = new URLSearchParams({'name': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getTermType()).toBe(expected)
      done()
    })
  })

  it('checkPathIsDirectory() no path given', (done) => {
    this.element.checkPathIsDirectory().then((isDirectory) => {
      expect(isDirectory).toBe(false)
      done()
    })
  })

  it('checkPathIsDirectory() path set to undefined', (done) => {
    this.element.checkPathIsDirectory(undefined).then((isDirectory) => {
      expect(isDirectory).toBe(false)
      done()
    })
  })

  it('checkPathIsDirectory() path set to null', (done) => {
    this.element.checkPathIsDirectory(null).then((isDirectory) => {
      expect(isDirectory).toBe(false)
      done()
    })
  })

  it('checkPathIsDirectory() path set to tmpdir', (done) => {
    this.element.checkPathIsDirectory(this.tmpdir).then((isDirectory) => {
      expect(isDirectory).toBe(true)
      done()
    })
  })

  it('checkPathIsDirectory() path set to non-existent dir', (done) => {
    this.element.checkPathIsDirectory(path.join(this.tmpdir, 'non-existent-dir')).then((isDirectory) => {
      expect(isDirectory).toBe(false)
      done()
    })
  })

  it('getCwd()', (done) => {
    this.element.getCwd().then((cwd) => {
      expect(cwd).toBe(config.getDefaultCwd())
      done()
    })
  })

  it('getCwd() cwd set in uri', (done) => {
    let expected = this.tmpdir
    let params = new URLSearchParams({'cwd': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      element.getCwd().then((cwd) => {
        expect(cwd).toBe(expected)
        done()
      })
    })
  })

  it('getCwd() model getPath() returns valid path', (done) => {
    let previousActiveItem = jasmine.createSpyObj(
      'previousActiveItem',
      ['getPath']
    )
    previousActiveItem.getPath.and.returnValue(this.tmpdir)
    spyOn(atom.workspace, 'getActivePaneItem').and.returnValue(
      previousActiveItem
    )
    createNewElement().then((element) => {
      element.getCwd().then((cwd) => {
        expect(cwd).toBe(this.tmpdir)
        done()
      })
    })
  })

  it('getCwd() model getPath() returns invalid path', (done) => {
    let previousActiveItem = jasmine.createSpyObj(
      'previousActiveItem',
      ['getPath']
    )
    previousActiveItem.getPath.and.returnValue(path.join(this.tmpdir, 'non-existent-dir'))
    spyOn(atom.workspace, 'getActivePaneItem').and.returnValue(
      previousActiveItem
    )
    createNewElement().then((element) => {
      element.getCwd().then((cwd) => {
        expect(cwd).toBe(config.getDefaultCwd())
        done()
      })
    })
  })

  it('getCwd() non-existent cwd set in uri', (done) => {
    let dir = path.join(this.tmpdir, 'non-existent-dir')
    let params = new URLSearchParams({'cwd': dir})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      this.element.getCwd().then((cwd) => {
        expect(cwd).toBe(config.getDefaultCwd())
        done()
      })
    })
  })

  it('getCwd() non-existent project path added', (done) => {
    spyOn(atom.project, 'getPaths').and.returnValue([path.join(this.tmpdir, 'non-existent-dir')])
    createNewElement().then((element) => {
      element.getCwd().then((cwd) => {
        expect(cwd).toBe(config.getDefaultCwd())
        done()
      })
    })
  })

  it('getEnv()', () => {
    expect(JSON.stringify(this.element.getEnv())).toEqual(JSON.stringify(process.env))
  })

  it('getEnv() env set in uri', (done) => {
    let expected = {'var1': 'value1', 'var2': 'value2'}
    let params = new URLSearchParams({'env': JSON.stringify(expected)})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getEnv()).toEqual(expected)
      done()
    })
  })

  it('getEnv() throw exception when env is not an object', () => {
    this.element.model.profile.env = []
    expect(() => { this.element.getEnv() }).toThrow(new Error('Environment set is not an object.'))
  })

  it('getEnv() setEnv set in uri', (done) => {
    let expected = {'var2': 'value2'}
    let params = new URLSearchParams({'env': JSON.stringify({'var1': 'value1'}), 'setEnv': JSON.stringify(expected)})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getEnv()['var2']).toEqual(expected['var2'])
      done()
    })
  })

  it('getEnv() deleteEnv set in config', () => {
    atom.config.set('atom-xterm.spawnPtySettings.env', JSON.stringify({'var1': 'value1'}))
    atom.config.set('atom-xterm.spawnPtySettings.deleteEnv', JSON.stringify(['var1']))
    expect(this.element.getEnv()['var1']).toBe(undefined)
  })

  it('getEnv() deleteEnv set in uri', (done) => {
    let params = new URLSearchParams({'env': JSON.stringify({'var1': 'value1'}), 'deleteEnv': JSON.stringify(['var1'])})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(this.element.getEnv()['var1']).toBe(undefined)
      done()
    })
  })

  it('getEnv() deleteEnv has precendence over senEnv', () => {
    atom.config.set('atom-xterm.spawnPtySettings.env', JSON.stringify({'var1': 'value1'}))
    atom.config.set('atom-xterm.spawnPtySettings.setEnv', JSON.stringify({'var2': 'value2'}))
    atom.config.set('atom-xterm.spawnPtySettings.deleteEnv', JSON.stringify(['var2']))
    expect(this.element.getEnv()['var2']).toBe(undefined)
  })

  it('getEncoding()', () => {
    expect(this.element.getEncoding()).toBeNull()
  })

  it('getEncoding() encoding set in uri', (done) => {
    let expected = 'someencoding'
    let params = new URLSearchParams({'encoding': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.getEncoding()).toBe(expected)
      done()
    })
  })

  it('leaveOpenAfterExit()', () => {
    expect(this.element.leaveOpenAfterExit()).toBe(true)
  })

  it('leaveOpenAfterExit() true set in uri', (done) => {
    let expected = true
    let params = new URLSearchParams({'leaveOpenAfterExit': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.leaveOpenAfterExit()).toBe(expected)
      done()
    })
  })

  it('leaveOpenAfterExit() false set in uri', (done) => {
    let expected = false
    let params = new URLSearchParams({'leaveOpenAfterExit': expected})
    let url = new URL('atom-xterm://?' + params.toString())
    createNewElement(url.href).then((element) => {
      expect(element.leaveOpenAfterExit()).toBe(expected)
      done()
    })
  })

  it('isPtyProcessRunning() ptyProcess null, ptyProcessRunning false', () => {
    this.element.ptyProcess = null
    this.element.ptyProcessRunning = false
    expect(this.element.isPtyProcessRunning()).toBeFalsy()
  })

  it('isPtyProcessRunning() ptyProcess not null, ptyProcessRunning false', () => {
    this.element.ptyProcess = jasmine.createSpyObj('ptyProcess', ['kill'])
    this.element.ptyProcessRunning = false
    expect(this.element.isPtyProcessRunning()).toBeFalsy()
  })

  it('isPtyProcessRunning() ptyProcess not null, ptyProcessRunning true', () => {
    this.element.ptyProcess = jasmine.createSpyObj('ptyProcess', ['kill'])
    this.element.ptyProcessRunning = true
    expect(this.element.isPtyProcessRunning()).toBeTruthy()
  })

  it('createTerminal() check terminal object', () => {
    expect(this.element.terminal).toBeTruthy()
  })

  it('createTerminal() check ptyProcess object', () => {
    expect(this.element.ptyProcess).toBeTruthy()
  })

  it('restartPtyProcess() check new pty process created', (done) => {
    let oldPtyProcess = this.element.ptyProcess
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = jasmine.createSpy('process')
      .and.returnValue('sometestprocess')
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.restartPtyProcess().then(() => {
      expect(this.element.ptyProcess).toBe(newPtyProcess)
      expect(oldPtyProcess).not.toBe(this.element.ptyProcess)
      done()
    })
  })

  it('restartPtyProcess() check ptyProcessRunning set to true', (done) => {
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = jasmine.createSpy('process')
      .and.returnValue('sometestprocess')
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.restartPtyProcess().then(() => {
      expect(this.element.ptyProcessRunning).toBe(true)
      done()
    })
  })

  it('restartPtyProcess() command not found', (done) => {
    spyOn(this.element, 'showNotification')
    this.element.model.profile.command = 'somecommand'
    let fakeCall = () => {
      throw Error('File not found: somecommand')
    }
    nodePty.spawn.and.callFake(fakeCall)
    this.element.restartPtyProcess().then(() => {
      expect(this.element.ptyProcess).toBe(null)
      expect(this.element.ptyProcessRunning).toBe(false)
      expect(this.element.showNotification.calls.argsFor(0)).toEqual(
        [
          "Could not find command 'somecommand'.",
          'error'
        ]
      )
      done()
    })
  })

  it('restartPtyProcess() some other error thrown', (done) => {
    spyOn(this.element, 'showNotification')
    this.element.model.profile.command = 'somecommand'
    let fakeCall = () => {
      throw Error('Something went wrong')
    }
    nodePty.spawn.and.callFake(fakeCall)
    this.element.restartPtyProcess().then(() => {
      expect(this.element.ptyProcess).toBe(null)
      expect(this.element.ptyProcessRunning).toBe(false)
      expect(this.element.showNotification.calls.argsFor(0)).toEqual(
        [
          "Launching 'somecommand' raised the following error: Something went wrong",
          'error'
        ]
      )
      done()
    })
  })

  it('ptyProcess exit handler set ptyProcessRunning to false', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(false)
    exitHandler(0)
    expect(this.element.ptyProcessRunning).toBe(false)
  })

  it('ptyProcess exit handler code 0 don\'t leave open', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(false)
    exitHandler(0)
    expect(this.element.model.exit).toHaveBeenCalled()
  })

  it('ptyProcess exit handler code 1 don\'t leave open', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(false)
    exitHandler(1)
    expect(this.element.model.exit).toHaveBeenCalled()
  })

  it('ptyProcess exit handler code 0 leave open', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(0)
    expect(this.element.model.exit).not.toHaveBeenCalled()
  })

  it('ptyProcess exit handler code 0 leave open check top message', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(0)
    let successDiv = this.element.topDiv.querySelector('.atom-xterm-notice-success')
    let errorDiv = this.element.topDiv.querySelector('.atom-xterm-notice-error')
    expect(successDiv).not.toBeNull()
    expect(errorDiv).toBeNull()
  })

  it('ptyProcess exit handler code 1 leave open check top message', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(1)
    let successDiv = this.element.topDiv.querySelector('.atom-xterm-notice-success')
    let errorDiv = this.element.topDiv.querySelector('.atom-xterm-notice-error')
    expect(successDiv).toBeNull()
    expect(errorDiv).not.toBeNull()
  })

  it('ptyProcess exit handler code 0 leave open check top message has restart button', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(0)
    let messageDiv = this.element.topDiv.querySelector('.atom-xterm-notice-success')
    let restartButton = messageDiv.querySelector('.btn-success')
    expect(restartButton).not.toBeNull()
  })

  it('ptyProcess exit handler code 1 leave open check top message has restart button', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(1)
    let messageDiv = this.element.topDiv.querySelector('.atom-xterm-notice-error')
    let restartButton = messageDiv.querySelector('.btn-error')
    expect(restartButton).not.toBeNull()
  })

  it('ptyProcess exit handler code 0 leave open check restart button click handler', () => {
    let exitHandler
    for (let arg of this.element.ptyProcess.on.calls.allArgs()) {
      if (arg[0] === 'exit') {
        exitHandler = arg[1]
        break
      }
    }
    spyOn(this.element.model, 'exit')
    spyOn(this.element, 'leaveOpenAfterExit').and.returnValue(true)
    exitHandler(0)
    let messageDiv = this.element.topDiv.querySelector('.atom-xterm-notice-success')
    let restartButton = messageDiv.querySelector('.btn-success')
    spyOn(this.element, 'restartPtyProcess')
    let mouseEvent = new MouseEvent('click')
    restartButton.dispatchEvent(mouseEvent)
    expect(this.element.restartPtyProcess).toHaveBeenCalled()
  })

  it('refitTerminal()', () => {
    spyOn(this.element.terminal, 'fit')
    this.element.refitTerminal()
    expect(this.element.terminal.fit).toHaveBeenCalled()
  })

  it('ptyProcess resized while running when terminal resized', () => {
    this.element.ptyProcessRunning = true
    this.element.terminal.resize(1, 1)
    expect(this.element.ptyProcess.resize.calls.allArgs()).toEqual([[1, 1]])
  })

  it('ptyProcess not resized when stopped when terminal resized', () => {
    this.element.ptyProcessRunning = false
    this.element.terminal.resize(1, 1)
    expect(this.element.ptyProcess.resize).not.toHaveBeenCalled()
  })

  it('focusOnTerminal()', () => {
    spyOn(this.element.terminal, 'focus')
    this.element.focusOnTerminal()
    expect(this.element.terminal.focus).toHaveBeenCalled()
  })

  it('focusOnTerminal() terminal not set', () => {
    this.element.terminal = null
    this.element.focusOnTerminal()
  })

  it('toggleProfileMenu()', (done) => {
    this.element.atomXtermProfileMenuElement = jasmine.createSpyObj(
      'atomXtermProfileMenuElement',
      [
        'toggleProfileMenu',
        'destroy'
      ]
    )
    this.element.atomXtermProfileMenuElement.initializedPromise = Promise.resolve()
    let toggleCallback = () => {
      done()
    }
    this.element.atomXtermProfileMenuElement.toggleProfileMenu.and.callFake(toggleCallback)
    this.element.toggleProfileMenu()
  })

  it('setNewProfile()', () => {
    let mock = jasmine.createSpy('mock')
    this.element.setNewProfile(mock)
    expect(this.element.model.profile).toBe(mock)
  })

  it('hideTerminal()', () => {
    this.element.hideTerminal()
    expect(this.element.terminalDiv.style.visibility).toBe('hidden')
  })

  it('showTerminal()', () => {
    this.element.showTerminal()
    expect(this.element.terminalDiv.style.visibility).toBe('visible')
  })

  it('hoveredLink initially null', () => {
    expect(this.element.hoveredLink).toBeNull()
  })

  it('terminalDiv initially does not have link class', () => {
    expect(this.element.terminalDiv.classList.contains('atom-xterm-term-container-has-link')).toBe(false)
  })

  it('setHoveredLink(\'https://atom.io\')', () => {
    let expected = 'https://atom.io'
    this.element.setHoveredLink(expected)
    expect(this.element.hoveredLink).toBe(expected)
    expect(this.element.terminalDiv.classList.contains('atom-xterm-term-container-has-link')).toBe(true)
  })

  it('clearHoveredLink()', () => {
    this.element.setHoveredLink('https://atom.io')
    this.element.clearHoveredLink()
    expect(this.element.hoveredLink).toBeNull()
    expect(this.element.terminalDiv.classList.contains('atom-xterm-term-container-has-link')).toBe(false)
  })

  it('openHoveredLink() no hovered link set', () => {
    this.element.openHoveredLink()
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('openHoveredLink() hovered link set', () => {
    this.element.hoveredLink = 'https://atom.io'
    this.element.openHoveredLink()
    expect(shell.openExternal.calls.argsFor(0)).toEqual(['https://atom.io'])
  })

  it('getHoveredLink() no hovered link set', () => {
    expect(this.element.getHoveredLink()).toBeFalsy()
  })

  it('openHoveredLink() hovered link set', () => {
    this.element.hoveredLink = 'https://atom.io'
    expect(this.element.getHoveredLink()).toBe('https://atom.io')
  })

  it('on \'data\' handler no custom title on win32 platform', (done) => {
    Object.defineProperty(process, 'platform', {
      'value': 'win32'
    })
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(0)
      let onDataCallback = args[1]
      onDataCallback('')
      expect(this.element.model.title).toBe('Atom Xterm')
      done()
    })
  })

  it('on \'data\' handler no custom title on linux platform', (done) => {
    Object.defineProperty(process, 'platform', {
      'value': 'linux'
    })
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(0)
      let onDataCallback = args[1]
      onDataCallback('')
      expect(this.element.model.title).toBe('sometestprocess')
      done()
    })
  })

  it('on \'data\' handler custom title on win32 platform', (done) => {
    Object.defineProperty(process, 'platform', {
      'value': 'win32'
    })
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.model.profile.title = 'foo'
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(0)
      let onDataCallback = args[1]
      onDataCallback('')
      expect(this.element.model.title).toBe('foo')
      done()
    })
  })

  it('on \'data\' handler custom title on linux platform', (done) => {
    Object.defineProperty(process, 'platform', {
      'value': 'linux'
    })
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.model.profile.title = 'foo'
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(0)
      let onDataCallback = args[1]
      onDataCallback('')
      expect(this.element.model.title).toBe('foo')
      done()
    })
  })

  it('on \'exit\' handler leave open after exit success', (done) => {
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.model.profile.title = 'foo'
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(1)
      let onExitCallback = args[1]
      this.element.model.profile.leaveOpenAfterExit = true
      onExitCallback(0)
      expect(this.element.querySelector('.atom-xterm-notice-success')).toBeTruthy()
      expect(this.element.querySelector('.atom-xterm-notice-error')).toBe(null)
      done()
    })
  })

  it('on \'exit\' handler leave open after exit failure', (done) => {
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.model.profile.title = 'foo'
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(1)
      let onExitCallback = args[1]
      this.element.model.profile.leaveOpenAfterExit = true
      onExitCallback(1)
      expect(this.element.querySelector('.atom-xterm-notice-success')).toBe(null)
      expect(this.element.querySelector('.atom-xterm-notice-error')).toBeTruthy()
      done()
    })
  })

  it('on \'exit\' handler do not leave open', (done) => {
    let newPtyProcess = jasmine.createSpyObj('ptyProcess',
      ['kill', 'write', 'resize', 'on', 'removeAllListeners'])
    newPtyProcess.process = 'sometestprocess'
    nodePty.spawn.and.returnValue(newPtyProcess)
    this.element.model.profile.title = 'foo'
    this.element.restartPtyProcess().then(() => {
      let args = this.element.ptyProcess.on.calls.argsFor(1)
      let onExitCallback = args[1]
      this.element.model.profile.leaveOpenAfterExit = false
      spyOn(this.element.model, 'exit')
      onExitCallback(1)
      expect(this.element.model.exit).toHaveBeenCalled()
      done()
    })
  })

  it('showNotification() success message', () => {
    this.element.showNotification(
      'foo',
      'success'
    )
    let messageDiv = this.element.topDiv.querySelector('.atom-xterm-notice-success')
    expect(messageDiv.textContent).toBe('fooRestart')
  })

  it('showNotification() error message', () => {
    this.element.showNotification(
      'foo',
      'error'
    )
    let messageDiv = this.element.topDiv.querySelector('.atom-xterm-notice-error')
    expect(messageDiv.textContent).toBe('fooRestart')
  })

  it('showNotification() success message with Atom notification', () => {
    spyOn(atom.notifications, 'addSuccess')
    this.element.showNotification(
      'foo',
      'success'
    )
    expect(atom.notifications.addSuccess).toHaveBeenCalled()
  })

  it('showNotification() error message with Atom notification', () => {
    spyOn(atom.notifications, 'addError')
    this.element.showNotification(
      'foo',
      'error'
    )
    expect(atom.notifications.addError).toHaveBeenCalled()
  })

  it('showNotification() warning message with Atom notification', () => {
    spyOn(atom.notifications, 'addWarning')
    this.element.showNotification(
      'foo',
      'warning'
    )
    expect(atom.notifications.addWarning).toHaveBeenCalled()
  })

  it('showNotification() info message with Atom notification', () => {
    spyOn(atom.notifications, 'addInfo')
    this.element.showNotification(
      'foo',
      'info'
    )
    expect(atom.notifications.addInfo).toHaveBeenCalled()
  })

  it('showNotification() bogus info type with Atom notification', () => {
    let call = () => {
      this.element.showNotification(
        'foo',
        'bogus'
      )
    }
    expect(call).toThrow(new Error('Unknown info type: bogus'))
  })
})
