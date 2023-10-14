[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/token-types

# Module: @plaited/token-types

## Table of contents

### Interfaces

- [DesignTokenGroup](../interfaces/plaited_token_types.DesignTokenGroup.md)

### Type Aliases

- [$FormatterValue](plaited_token_types.md#$formattervalue)
- [$Value](plaited_token_types.md#$value)
- [AliasValue](plaited_token_types.md#aliasvalue)
- [AlignItemsValue](plaited_token_types.md#alignitemsvalue)
- [BorderValue](plaited_token_types.md#bordervalue)
- [ColorValue](plaited_token_types.md#colorvalue)
- [DesignToken](plaited_token_types.md#designtoken)
- [DimensionValue](plaited_token_types.md#dimensionvalue)
- [DisplayValue](plaited_token_types.md#displayvalue)
- [DistributeContentValue](plaited_token_types.md#distributecontentvalue)
- [DropShadowValue](plaited_token_types.md#dropshadowvalue)
- [FlexDirectionValue](plaited_token_types.md#flexdirectionvalue)
- [FlexValue](plaited_token_types.md#flexvalue)
- [FlexWrapValue](plaited_token_types.md#flexwrapvalue)
- [FontFamilyValue](plaited_token_types.md#fontfamilyvalue)
- [FontSizeValue](plaited_token_types.md#fontsizevalue)
- [FontStyleValue](plaited_token_types.md#fontstylevalue)
- [FontWeightValue](plaited_token_types.md#fontweightvalue)
- [GapValue](plaited_token_types.md#gapvalue)
- [GradientValue](plaited_token_types.md#gradientvalue)
- [GridAutoFlowValue](plaited_token_types.md#gridautoflowvalue)
- [GridMinMaxArgs](plaited_token_types.md#gridminmaxargs)
- [GridTemplateRowsOrColumnsValue](plaited_token_types.md#gridtemplaterowsorcolumnsvalue)
- [GridTemplateValue](plaited_token_types.md#gridtemplatevalue)
- [GridValue](plaited_token_types.md#gridvalue)
- [LetterSpacingValue](plaited_token_types.md#letterspacingvalue)
- [LineHeightValue](plaited_token_types.md#lineheightvalue)
- [PercentageRatioValue](plaited_token_types.md#percentageratiovalue)
- [PrimitiveArrayValue](plaited_token_types.md#primitivearrayvalue)
- [PrimitiveValue](plaited_token_types.md#primitivevalue)
- [ScalarDimensionValue](plaited_token_types.md#scalardimensionvalue)
- [TextTransformValue](plaited_token_types.md#texttransformvalue)
- [TimingValue](plaited_token_types.md#timingvalue)
- [TransitionValue](plaited_token_types.md#transitionvalue)
- [TypographyValue](plaited_token_types.md#typographyvalue)

## Type Aliases

### $FormatterValue

Ƭ **$FormatterValue**: [`PrimitiveValue`](plaited_token_types.md#primitivevalue) \| [`PrimitiveArrayValue`](plaited_token_types.md#primitivearrayvalue) \| [`BorderValue`](plaited_token_types.md#bordervalue) \| [`DimensionValue`](plaited_token_types.md#dimensionvalue) \| [`GradientValue`](plaited_token_types.md#gradientvalue) \| [`DropShadowValue`](plaited_token_types.md#dropshadowvalue) \| [`GapValue`](plaited_token_types.md#gapvalue) \| [`FlexValue`](plaited_token_types.md#flexvalue) \| [`GridTemplateValue`](plaited_token_types.md#gridtemplatevalue) \| [`GridValue`](plaited_token_types.md#gridvalue) \| [`TransitionValue`](plaited_token_types.md#transitionvalue) \| [`FontFamilyValue`](plaited_token_types.md#fontfamilyvalue) \| [`TypographyValue`](plaited_token_types.md#typographyvalue)

#### Defined in

[index.ts:334](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L334)

___

### $Value

Ƭ **$Value**: `ValueAndType`[``"$value"``]

#### Defined in

[index.ts:465](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L465)

___

### AliasValue

Ƭ **AliasValue**: \`{${string}}\`

Alias value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:4](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L4)

___

### AlignItemsValue

Ƭ **AlignItemsValue**: ``"stretch"`` \| ``"center"`` \| ``"baseline"`` \| ``"start"`` \| ``"end"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

AlignItems value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:98](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L98)

___

### BorderValue

Ƭ **BorderValue**: { `color`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `style`: ``"solid"`` \| ``"dashed"`` \| ``"dotted"`` \| ``"double"`` \| ``"groove"`` \| ``"ridge"`` \| ``"outset"`` \| ``"inset"`` ; `width`: `number` \| [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Border value type relies on the border formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:37](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L37)

___

### ColorValue

Ƭ **ColorValue**: \`#${string}\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Color value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:19](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L19)

___

### DesignToken

Ƭ **DesignToken**: { `$description`: `string` ; `$extensions?`: `$Extensions`  } & `ValueAndType`

#### Defined in

[index.ts:468](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L468)

___

### DimensionValue

Ƭ **DimensionValue**: `number` \| [`ScalarDimensionValue`](plaited_token_types.md#scalardimensionvalue) \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Dimension value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:28](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L28)

___

### DisplayValue

Ƭ **DisplayValue**: ``"flex"`` \| ``"inline-flex"`` \| ``"grid"`` \| ``"inline-grid"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Display value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:108](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L108)

___

### DistributeContentValue

Ƭ **DistributeContentValue**: ``"start"`` \| ``"end"`` \| ``"center"`` \| ``"space-between"`` \| ``"space-around"`` \| ``"stretch"`` \| ``"space-evenly"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

DistributeContent value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:117](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L117)

___

### DropShadowValue

Ƭ **DropShadowValue**: { `blur?`: `number` ; `color?`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `offsetX`: `number` ; `offsetY`: `number`  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

DropShadow value type relies on the dropShadow formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:55](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L55)

___

### FlexDirectionValue

Ƭ **FlexDirectionValue**: ``"row"`` \| ``"row-reverse"`` \| ``"column"`` \| ``"column-reverse"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FlexDirection value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:129](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L129)

___

### FlexValue

Ƭ **FlexValue**: { `alignContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `alignItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `columnGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `display`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `flexDirection?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `flexWrap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `rowGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Flex value type used for applying aliased flex rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:144](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L144)

___

### FlexWrapValue

Ƭ **FlexWrapValue**: ``"wrap"`` \| ``"wrap-reverse"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FlexWrap value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:138](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L138)

___

### FontFamilyValue

Ƭ **FontFamilyValue**: `string` \| `string`[] \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontFamily value type relies on the fontFamily formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:259](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L259)

___

### FontSizeValue

Ƭ **FontSizeValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:264](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L264)

___

### FontStyleValue

Ƭ **FontStyleValue**: ``"normal"`` \| ``"italic"`` \| ``"oblique"`` \| \`oblique ${number}deg\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontStyle value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:268](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L268)

___

### FontWeightValue

Ƭ **FontWeightValue**: ``100`` \| ``200`` \| ``300`` \| ``400`` \| ``500`` \| ``600`` \| ``700`` \| ``800`` \| ``900`` \| ``"normal"`` \| ``"bold"`` \| ``"lighter"`` \| ``"bolder"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontWeight value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:277](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L277)

___

### GapValue

Ƭ **GapValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue) \| \`${number}%\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Gap value type relies on the gap formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:158](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L158)

___

### GradientValue

Ƭ **GradientValue**: { `angleShapePosition?`: `string` ; `colorStops`: { `color?`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `position?`: `string`  }[] ; `gradientFunction`: ``"linear-gradient"`` \| ``"radial-gradient"`` \| ``"conic-gradient"`` \| ``"repeating-linear-gradient"`` \| ``"repeating-radial-gradient"`` \| ``"repeating-conic-gradient"``  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Gradient value type relies on the gradient formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:66](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L66)

___

### GridAutoFlowValue

Ƭ **GridAutoFlowValue**: ``"row"`` \| ``"column"`` \| ``"row dense"`` \| ``"column dense"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

GridAutoFlow value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:162](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L162)

___

### GridMinMaxArgs

Ƭ **GridMinMaxArgs**: `number` \| \`${number}fr\` \| \`${number}%\` \| ``"auto"`` \| ``"min-content"`` \| ``"max-content"``

#### Defined in

[index.ts:169](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L169)

___

### GridTemplateRowsOrColumnsValue

Ƭ **GridTemplateRowsOrColumnsValue**: (`GridTemplateAxisValue` \| { `count`: `number` \| ``"auto-fill"`` \| ``"auto-fit"`` ; `function`: ``"repeat"`` ; `tracks`: `GridTemplateAxisValue`[]  })[]

#### Defined in

[index.ts:188](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L188)

___

### GridTemplateValue

Ƭ **GridTemplateValue**: `GridTemplateAreasValue` \| [`GridTemplateRowsOrColumnsValue`](plaited_token_types.md#gridtemplaterowsorcolumnsvalue)

GridTemplate value type relies on the gridTemplate formatter for css tokens
and the defaultFormat formatter for ts tokens
It is used to store grid-template-areas | grid-template-columns | grid-template-rows values

#### Defined in

[index.ts:198](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L198)

___

### GridValue

Ƭ **GridValue**: { `alignContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `alignItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `columnGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `display`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoColumns?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoFlow?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoRows?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateAreas?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateColumns?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateRows?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `rowGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Grid value type used for applying aliased grid rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:207](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L207)

___

### LetterSpacingValue

Ƭ **LetterSpacingValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:296](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L296)

___

### LineHeightValue

Ƭ **LineHeightValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:301](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L301)

___

### PercentageRatioValue

Ƭ **PercentageRatioValue**: \`${number}:${number}\` \| \`${number}%\` \| ``1`` \| ``0`` \| \`0.${number}\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

PercentageRatio value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:84](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L84)

___

### PrimitiveArrayValue

Ƭ **PrimitiveArrayValue**: (`string` \| `number`)[] \| [`AliasValue`](plaited_token_types.md#aliasvalue)

PrimitiveArray value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:14](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L14)

___

### PrimitiveValue

Ƭ **PrimitiveValue**: `string` \| `number` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Primitive value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:9](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L9)

___

### ScalarDimensionValue

Ƭ **ScalarDimensionValue**: `Object`

#### Index signature

▪ [key: `string`]: `number`

#### Defined in

[index.ts:21](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L21)

___

### TextTransformValue

Ƭ **TextTransformValue**: ``"none"`` \| ``"capitalize"`` \| ``"uppercase"`` \| ``"lowercase"`` \| ``"full-width"`` \| ``"full-size-kana"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontWeight value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:305](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L305)

___

### TimingValue

Ƭ **TimingValue**: \`${number}s\` \| \`${number}ms\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontStyle value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:229](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L229)

___

### TransitionValue

Ƭ **TransitionValue**: { `delay?`: [`TimingValue`](plaited_token_types.md#timingvalue) ; `duration`: [`TimingValue`](plaited_token_types.md#timingvalue) ; `timingFunction?`: ``"ease"`` \| ``"linear"`` \| ``"ease-in"`` \| ``"ease-out"`` \| ``"ease-in-out"`` \| ``"step-start"`` \| ``"step-end"`` \| { `function`: ``"steps"`` \| ``"cubic-bezier"`` ; `values`: (`string` \| `number`)[]  }  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Transition value type relies on the transition formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:234](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L234)

___

### TypographyValue

Ƭ **TypographyValue**: { `fontFamily`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontSize`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontStyle?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontWeight`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `letterSpacing?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `lineHeight?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `textTransform?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Typography value type used for applying aliased typography rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:318](https://github.com/plaited/plaited/blob/495e314/libs/token-types/src/index.ts#L318)
