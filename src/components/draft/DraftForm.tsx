import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ReactNode } from 'react'
import { keyCount } from '../../core/keys'
import { AREAS, FILETYPES, GROUPS, PRESETS } from '../../core/schema'
import { useDraftStore } from '../../store/draftStore'
import { Field } from '../common/Field'
import { Row } from '../common/Row'
import { Section } from '../common/Section'

const LEVELS = ['1', '2', '3', '4', '5']

function More({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordion disableGutters variant="outlined" sx={{ borderRadius: '10px !important' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" color="primary">
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  )
}

function Describe() {
  return (
    <Section title="1. Describe the challenge">
      <Field field="title" label="Title" placeholder="Swap two words" max={60} />
      <Row>
        <Field field="id" label="id (file name)" placeholder="swap-two-words" max={40} />
        <Field field="area" label="Skill area" options={AREAS} />
        <Field field="level" label="Level 1-5" options={LEVELS} />
      </Row>
      <Field
        field="brief"
        label="Task (describe the END STATE, not the keys)"
        placeholder="Make the line read: world hello"
        multiline
        rows={2}
        max={240}
      />
      <Field field="text" label="Start buffer" placeholder="hello world" multiline rows={5} />
      <Row>
        <Field field="crow" label="Cursor row (1-based)" type="number" />
        <Field field="ccol" label="Cursor col (0-based)" type="number" />
        <Field field="ft" label="Filetype" options={FILETYPES} />
      </Row>
    </Section>
  )
}

function Expected() {
  const altBuffer = useDraftStore((s) => s.form.altBuffer)
  const set = useDraftStore((s) => s.set)
  return (
    <Section title="2. Expected end state">
      <Field
        field="etext"
        label="Expected buffer text (leave empty to ignore)"
        placeholder="world hello"
        multiline
        rows={4}
        helper="Trailing spaces and blank lines at the end are ignored."
      />
      <Row>
        <Field field="erow" label="Expected cursor row" type="number" />
        <Field field="ecol" label="Expected cursor col" type="number" helper="empty = any" />
      </Row>
      <More title="More assertions and presets (windows, tabs, quickfix, diagnostics, marks)">
        <Row>
          <Field field="windows" label="Windows in the tab" type="number" />
          <Field field="layout" label="Layout" options={['', 'row', 'col']} blank="any" />
          <Field field="extraTabs" label="New tabs open" type="number" />
        </Row>
        <Row>
          <Field field="qidx" label="Quickfix current index" type="number" />
          <Field field="qsize" label="Quickfix size" type="number" />
          <Field field="qall" label="Every quickfix item contains" max={60} />
        </Row>
        <Row>
          <Field field="floatText" label="A floating window contains" placeholder="ARC:" max={80} />
          <Field field="marks" label="Marks (a=3, b=11)" placeholder="a=3,b=11" />
        </Row>
        <FormControlLabel
          label="End in the other buffer"
          control={<Checkbox checked={altBuffer} onChange={(e) => set('altBuffer', e.target.checked)} />}
        />
        <Row>
          <Field field="preset" label="Preset set-up" options={PRESETS} />
          <Field field="presetRows" label="Preset lines (1,4,9)" placeholder="4,9" />
        </Row>
        <Typography variant="caption" color="text.secondary">
          Presets: diagnostics plants warnings on those lines, splits opens three windows, alt_buffer puts you in a second
          buffer, quickfix_hits fills the quickfix list with those lines.
        </Typography>
      </More>
    </Section>
  )
}

function Solution() {
  const solution = useDraftStore((s) => s.form.solution)
  return (
    <Section title="3. Reference solution and lesson">
      <Field
        field="solution"
        label="Reference keys (Vim notation)"
        placeholder="dwA <Esc>p"
        max={120}
        helper={solution ? `par = ${keyCount(solution)} keys` : 'e.g. ci"new<Esc>'}
      />
      <Field
        field="why"
        label="Why this is the better way"
        placeholder="dw deletes a word with its space; p puts it back."
        multiline
        rows={2}
        max={300}
      />
      <Row>
        <Field field="hint" label="Hint (optional)" max={120} />
        <Field field="author" label="Your GitHub name" max={40} />
      </Row>
      <More title="Plugin tips (shown to players who have that kind of plugin)">
        <Row>
          <Field field="hgroup" label="Plugin group" options={['', ...GROUPS]} blank="(no plugin tip)" />
          <Field field="pluginPar" label="Keys with the plugin" type="number" />
          <Field field="needs" label="Only offer if player has" options={['', ...GROUPS]} blank="(always offer)" />
        </Row>
        <Field field="htip" label="Tip" placeholder="a surround plugin wraps it in 3-4 keys" max={200} />
      </More>
    </Section>
  )
}

export function DraftForm() {
  return (
    <Stack spacing={2}>
      <Describe />
      <Expected />
      <Solution />
    </Stack>
  )
}
