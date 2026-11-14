import Typography from '@mui/material/Typography'

interface ChapterHeadingProps {
  chapter: number
  title: string
}

const CHAPTER_TITLES: Record<number, string> = {
  1: 'Foundations',
  2: 'Building Speed',
  3: 'Mastery',
}

export function ChapterHeading({ chapter, title }: ChapterHeadingProps) {
  const subtitle = CHAPTER_TITLES[chapter] ?? ''
  return (
    <Typography
      variant="h6"
      sx={{
        fontFamily: 'monospace',
        color: '#d97706',
        mt: 3,
        mb: 1,
        pb: 0.5,
        borderBottom: '1px solid #44403c',
      }}
    >
      Chapter {chapter}: {subtitle} &mdash; {title}
    </Typography>
  )
}