# HEIC test fixture

`iphone-portrait.heic` is a real iPhone portrait sample copied from
[`openize-com/openize-heic-net`](https://github.com/openize-com/openize-heic-net/blob/main/Openize.Heic.Tests/TestsData/samples/iphone_portrait_photo.heic).

- SHA-256: `c782e03d1ef2a709f6a84ff1b1612ef2dfa909e4872958d3975e15c79ab523c3`
- Expected rendered dimensions: 3024 × 4032
- Relevant metadata: the HEIF primary image contains an `irot` transformation
- License: Openize License (BSD 2-Clause-derived); see `OPENIZE-LICENSE.txt`

The contract test decodes the generated JPEG and checks both its dimensions and
an upright image landmark so a rotation regression cannot pass on dimensions
alone.