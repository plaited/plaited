[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/token-types

# Module: @plaited/token-types

## Table of contents

### Interfaces

- [DesignTokenGroup](../interfaces/plaited_token_types.DesignTokenGroup.md)

### Type Aliases

- [$Context](plaited_token_types.md#$context)
- [AliasValue](plaited_token_types.md#aliasvalue)
- [AlignItemsToken](plaited_token_types.md#alignitemstoken)
- [AlignItemsValue](plaited_token_types.md#alignitemsvalue)
- [BaseToken](plaited_token_types.md#basetoken)
- [BorderToken](plaited_token_types.md#bordertoken)
- [BorderValue](plaited_token_types.md#bordervalue)
- [ColorToken](plaited_token_types.md#colortoken)
- [ColorValue](plaited_token_types.md#colorvalue)
- [ContextValue](plaited_token_types.md#contextvalue)
- [ContextualToken](plaited_token_types.md#contextualtoken)
- [DesignToken](plaited_token_types.md#designtoken)
- [DesignValue](plaited_token_types.md#designvalue)
- [DimensionLikeTokens](plaited_token_types.md#dimensionliketokens)
- [DimensionLikeValues](plaited_token_types.md#dimensionlikevalues)
- [DimensionToken](plaited_token_types.md#dimensiontoken)
- [DimensionValue](plaited_token_types.md#dimensionvalue)
- [DisplayToken](plaited_token_types.md#displaytoken)
- [DisplayValue](plaited_token_types.md#displayvalue)
- [DistributeContentToken](plaited_token_types.md#distributecontenttoken)
- [DistributeContentValue](plaited_token_types.md#distributecontentvalue)
- [DropShadowToken](plaited_token_types.md#dropshadowtoken)
- [DropShadowValue](plaited_token_types.md#dropshadowvalue)
- [FlexDirectionToken](plaited_token_types.md#flexdirectiontoken)
- [FlexDirectionValue](plaited_token_types.md#flexdirectionvalue)
- [FlexToken](plaited_token_types.md#flextoken)
- [FlexValue](plaited_token_types.md#flexvalue)
- [FlexWrapToken](plaited_token_types.md#flexwraptoken)
- [FlexWrapValue](plaited_token_types.md#flexwrapvalue)
- [FontFamilyToken](plaited_token_types.md#fontfamilytoken)
- [FontFamilyValue](plaited_token_types.md#fontfamilyvalue)
- [FontSizeToken](plaited_token_types.md#fontsizetoken)
- [FontSizeValue](plaited_token_types.md#fontsizevalue)
- [FontStyleToken](plaited_token_types.md#fontstyletoken)
- [FontStyleValue](plaited_token_types.md#fontstylevalue)
- [FontWeightToken](plaited_token_types.md#fontweighttoken)
- [FontWeightValue](plaited_token_types.md#fontweightvalue)
- [GapToken](plaited_token_types.md#gaptoken)
- [GapValue](plaited_token_types.md#gapvalue)
- [GradientToken](plaited_token_types.md#gradienttoken)
- [GradientValue](plaited_token_types.md#gradientvalue)
- [GridAutoFlowToken](plaited_token_types.md#gridautoflowtoken)
- [GridAutoFlowValue](plaited_token_types.md#gridautoflowvalue)
- [GridMinMaxArgs](plaited_token_types.md#gridminmaxargs)
- [GridTemplateAreasValue](plaited_token_types.md#gridtemplateareasvalue)
- [GridTemplateAxisValue](plaited_token_types.md#gridtemplateaxisvalue)
- [GridTemplateRowsOrColumnsValue](plaited_token_types.md#gridtemplaterowsorcolumnsvalue)
- [GridTemplateToken](plaited_token_types.md#gridtemplatetoken)
- [GridTemplateValue](plaited_token_types.md#gridtemplatevalue)
- [GridToken](plaited_token_types.md#gridtoken)
- [GridValue](plaited_token_types.md#gridvalue)
- [LetterSpacingToken](plaited_token_types.md#letterspacingtoken)
- [LetterSpacingValue](plaited_token_types.md#letterspacingvalue)
- [LineHeightToken](plaited_token_types.md#lineheighttoken)
- [LineHeightValue](plaited_token_types.md#lineheightvalue)
- [PercentageRatioToken](plaited_token_types.md#percentageratiotoken)
- [PercentageRatioValue](plaited_token_types.md#percentageratiovalue)
- [PrimitiveLikeTokens](plaited_token_types.md#primitiveliketokens)
- [PrimitiveLikeValues](plaited_token_types.md#primitivelikevalues)
- [PrimitiveToken](plaited_token_types.md#primitivetoken)
- [PrimitiveValue](plaited_token_types.md#primitivevalue)
- [StaticToken](plaited_token_types.md#statictoken)
- [TextTransformToken](plaited_token_types.md#texttransformtoken)
- [TextTransformValue](plaited_token_types.md#texttransformvalue)
- [TimingToken](plaited_token_types.md#timingtoken)
- [TimingValue](plaited_token_types.md#timingvalue)
- [TransitionToken](plaited_token_types.md#transitiontoken)
- [TransitionValue](plaited_token_types.md#transitionvalue)
- [TypographyToken](plaited_token_types.md#typographytoken)
- [TypographyValue](plaited_token_types.md#typographyvalue)

## Type Aliases

### $Context

Ƭ **$Context**: ``"media-query"`` \| ``"color-scheme"`` \| ``"container-query"``

#### Defined in

[index.ts:355](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L355)

___

### AliasValue

Ƭ **AliasValue**: \`{${string}}\`

Alias value type points to another token value

#### Defined in

[index.ts:4](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L4)

___

### AlignItemsToken

Ƭ **AlignItemsToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"alignItems"``, [`AlignItemsValue`](plaited_token_types.md#alignitemsvalue)\>

#### Defined in

[index.ts:388](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L388)

___

### AlignItemsValue

Ƭ **AlignItemsValue**: ``"stretch"`` \| ``"center"`` \| ``"baseline"`` \| ``"start"`` \| ``"end"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

AlignItems value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:92](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L92)

___

### BaseToken

Ƭ **BaseToken**<`T`, `V`\>: [`StaticToken`](plaited_token_types.md#statictoken)<`T`, `V`\> \| [`ContextualToken`](plaited_token_types.md#contextualtoken)<`T`, `V`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |
| `V` | extends [`DesignValue`](plaited_token_types.md#designvalue) |

#### Defined in

[index.ts:371](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L371)

___

### BorderToken

Ƭ **BorderToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"border"``, [`BorderValue`](plaited_token_types.md#bordervalue)\>

#### Defined in

[index.ts:380](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L380)

___

### BorderValue

Ƭ **BorderValue**: { `color`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `style`: ``"solid"`` \| ``"dashed"`` \| ``"dotted"`` \| ``"double"`` \| ``"groove"`` \| ``"ridge"`` \| ``"outset"`` \| ``"inset"`` ; `width`: `number` \| [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Border value type relies on the border formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:31](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L31)

___

### ColorToken

Ƭ **ColorToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"color"``, [`ColorValue`](plaited_token_types.md#colorvalue)\>

#### Defined in

[index.ts:376](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L376)

___

### ColorValue

Ƭ **ColorValue**: { `a?`: `number` ; `c?`: `number` \| \`${number}%\` ; `h?`: `number` \| \`${number}deg\` \| \`${number}grad\` \| \`${number}rad\` \| \`${number}turn\` ; `l?`: `number` \| \`${number}%\`  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Color value type relies on the color formatter for css tokens and defaultFormat formatter for ts tokens

#### Defined in

[index.ts:14](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L14)

___

### ContextValue

Ƭ **ContextValue**<`V`\>: `Object`

#### Type parameters

| Name |
| :------ |
| `V` |

#### Index signature

▪ [key: `string`]: `V`

#### Defined in

[index.ts:322](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L322)

___

### ContextualToken

Ƭ **ContextualToken**<`T`, `V`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |
| `V` | extends [`DesignValue`](plaited_token_types.md#designvalue) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `$context` | [`$Context`](plaited_token_types.md#$context) |
| `$description` | `string` |
| `$type` | `T` |
| `$value` | [`ContextValue`](plaited_token_types.md#contextvalue)<`V`\> |

#### Defined in

[index.ts:364](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L364)

___

### DesignToken

Ƭ **DesignToken**: [`PrimitiveToken`](plaited_token_types.md#primitivetoken) \| [`ColorToken`](plaited_token_types.md#colortoken) \| [`DimensionToken`](plaited_token_types.md#dimensiontoken) \| [`BorderToken`](plaited_token_types.md#bordertoken) \| [`DropShadowToken`](plaited_token_types.md#dropshadowtoken) \| [`GradientToken`](plaited_token_types.md#gradienttoken) \| [`PercentageRatioToken`](plaited_token_types.md#percentageratiotoken) \| [`AlignItemsToken`](plaited_token_types.md#alignitemstoken) \| [`DisplayToken`](plaited_token_types.md#displaytoken) \| [`DistributeContentToken`](plaited_token_types.md#distributecontenttoken) \| [`FlexDirectionToken`](plaited_token_types.md#flexdirectiontoken) \| [`FlexWrapToken`](plaited_token_types.md#flexwraptoken) \| [`FlexToken`](plaited_token_types.md#flextoken) \| [`GapToken`](plaited_token_types.md#gaptoken) \| [`GridAutoFlowToken`](plaited_token_types.md#gridautoflowtoken) \| [`GridTemplateToken`](plaited_token_types.md#gridtemplatetoken) \| [`GridToken`](plaited_token_types.md#gridtoken) \| [`TimingToken`](plaited_token_types.md#timingtoken) \| [`TransitionToken`](plaited_token_types.md#transitiontoken) \| [`FontFamilyToken`](plaited_token_types.md#fontfamilytoken) \| [`FontSizeToken`](plaited_token_types.md#fontsizetoken) \| [`FontStyleToken`](plaited_token_types.md#fontstyletoken) \| [`FontWeightToken`](plaited_token_types.md#fontweighttoken) \| [`LetterSpacingToken`](plaited_token_types.md#letterspacingtoken) \| [`LineHeightToken`](plaited_token_types.md#lineheighttoken) \| [`TextTransformToken`](plaited_token_types.md#texttransformtoken) \| [`TypographyToken`](plaited_token_types.md#typographytoken)

#### Defined in

[index.ts:443](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L443)

___

### DesignValue

Ƭ **DesignValue**: [`PrimitiveValue`](plaited_token_types.md#primitivevalue) \| [`ColorValue`](plaited_token_types.md#colorvalue) \| [`DimensionValue`](plaited_token_types.md#dimensionvalue) \| [`BorderValue`](plaited_token_types.md#bordervalue) \| [`DropShadowValue`](plaited_token_types.md#dropshadowvalue) \| [`GradientValue`](plaited_token_types.md#gradientvalue) \| [`PercentageRatioValue`](plaited_token_types.md#percentageratiovalue) \| [`AlignItemsValue`](plaited_token_types.md#alignitemsvalue) \| [`DisplayValue`](plaited_token_types.md#displayvalue) \| [`DistributeContentValue`](plaited_token_types.md#distributecontentvalue) \| [`FlexDirectionValue`](plaited_token_types.md#flexdirectionvalue) \| [`FlexWrapValue`](plaited_token_types.md#flexwrapvalue) \| [`FlexValue`](plaited_token_types.md#flexvalue) \| [`GapValue`](plaited_token_types.md#gapvalue) \| [`GridAutoFlowValue`](plaited_token_types.md#gridautoflowvalue) \| [`GridTemplateValue`](plaited_token_types.md#gridtemplatevalue) \| [`GridValue`](plaited_token_types.md#gridvalue) \| [`TimingValue`](plaited_token_types.md#timingvalue) \| [`TransitionValue`](plaited_token_types.md#transitionvalue) \| [`FontFamilyValue`](plaited_token_types.md#fontfamilyvalue) \| [`FontSizeValue`](plaited_token_types.md#fontsizevalue) \| [`FontStyleValue`](plaited_token_types.md#fontstylevalue) \| [`FontWeightValue`](plaited_token_types.md#fontweightvalue) \| [`LetterSpacingValue`](plaited_token_types.md#letterspacingvalue) \| [`LineHeightValue`](plaited_token_types.md#lineheightvalue) \| [`TextTransformValue`](plaited_token_types.md#texttransformvalue) \| [`TypographyValue`](plaited_token_types.md#typographyvalue)

#### Defined in

[index.ts:326](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L326)

___

### DimensionLikeTokens

Ƭ **DimensionLikeTokens**: [`DimensionToken`](plaited_token_types.md#dimensiontoken) \| [`LineHeightToken`](plaited_token_types.md#lineheighttoken) \| [`LetterSpacingToken`](plaited_token_types.md#letterspacingtoken) \| [`FontSizeToken`](plaited_token_types.md#fontsizetoken)

#### Defined in

[index.ts:477](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L477)

___

### DimensionLikeValues

Ƭ **DimensionLikeValues**: [`DimensionValue`](plaited_token_types.md#dimensionvalue) \| [`LineHeightValue`](plaited_token_types.md#lineheightvalue) \| [`LetterSpacingValue`](plaited_token_types.md#letterspacingvalue) \| [`FontSizeValue`](plaited_token_types.md#fontsizevalue)

#### Defined in

[index.ts:483](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L483)

___

### DimensionToken

Ƭ **DimensionToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"dimension"``, [`DimensionValue`](plaited_token_types.md#dimensionvalue)\>

#### Defined in

[index.ts:378](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L378)

___

### DimensionValue

Ƭ **DimensionValue**: `number` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Dimension value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:25](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L25)

___

### DisplayToken

Ƭ **DisplayToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"display"``, [`DisplayValue`](plaited_token_types.md#displayvalue)\>

#### Defined in

[index.ts:390](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L390)

___

### DisplayValue

Ƭ **DisplayValue**: ``"flex"`` \| ``"inline-flex"`` \| ``"grid"`` \| ``"inline-grid"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Display value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:102](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L102)

___

### DistributeContentToken

Ƭ **DistributeContentToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"distributeContent"``, [`DistributeContentValue`](plaited_token_types.md#distributecontentvalue)\>

#### Defined in

[index.ts:392](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L392)

___

### DistributeContentValue

Ƭ **DistributeContentValue**: ``"start"`` \| ``"end"`` \| ``"center"`` \| ``"space-between"`` \| ``"space-around"`` \| ``"stretch"`` \| ``"space-evenly"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

DistributeContent value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:111](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L111)

___

### DropShadowToken

Ƭ **DropShadowToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"dropShadow"``, [`DropShadowValue`](plaited_token_types.md#dropshadowvalue)\>

#### Defined in

[index.ts:382](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L382)

___

### DropShadowValue

Ƭ **DropShadowValue**: { `blur?`: `number` ; `color?`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `offsetX`: `number` ; `offsetY`: `number`  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

DropShadow value type relies on the dropShadow formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:49](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L49)

___

### FlexDirectionToken

Ƭ **FlexDirectionToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"flexDirection"``, [`FlexDirectionValue`](plaited_token_types.md#flexdirectionvalue)\>

#### Defined in

[index.ts:394](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L394)

___

### FlexDirectionValue

Ƭ **FlexDirectionValue**: ``"row"`` \| ``"row-reverse"`` \| ``"column"`` \| ``"column-reverse"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FlexDirection value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:123](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L123)

___

### FlexToken

Ƭ **FlexToken**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `$context?` | `never` |
| `$description` | `string` |
| `$type` | ``"flex"`` |
| `$value` | [`FlexValue`](plaited_token_types.md#flexvalue) |

#### Defined in

[index.ts:398](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L398)

___

### FlexValue

Ƭ **FlexValue**: { `alignContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `alignItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `columnGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `display`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `flexDirection?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `flexWrap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `rowGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Flex value type used for applying aliased flex rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:138](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L138)

___

### FlexWrapToken

Ƭ **FlexWrapToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"flexWrap"``, [`FlexWrapValue`](plaited_token_types.md#flexwrapvalue)\>

#### Defined in

[index.ts:396](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L396)

___

### FlexWrapValue

Ƭ **FlexWrapValue**: ``"wrap"`` \| ``"wrap-reverse"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FlexWrap value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:132](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L132)

___

### FontFamilyToken

Ƭ **FontFamilyToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"fontFamily"``, [`FontFamilyValue`](plaited_token_types.md#fontfamilyvalue)\>

#### Defined in

[index.ts:422](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L422)

___

### FontFamilyValue

Ƭ **FontFamilyValue**: `string` \| `string`[] \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontFamily value type relies on formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:253](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L253)

___

### FontSizeToken

Ƭ **FontSizeToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"fontSize"``, [`FontSizeValue`](plaited_token_types.md#fontsizevalue)\>

#### Defined in

[index.ts:424](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L424)

___

### FontSizeValue

Ƭ **FontSizeValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:258](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L258)

___

### FontStyleToken

Ƭ **FontStyleToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"fontStyle"``, [`FontStyleValue`](plaited_token_types.md#fontstylevalue)\>

#### Defined in

[index.ts:426](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L426)

___

### FontStyleValue

Ƭ **FontStyleValue**: ``"normal"`` \| ``"italic"`` \| ``"oblique"`` \| \`oblique ${number}deg\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontStyle value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:262](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L262)

___

### FontWeightToken

Ƭ **FontWeightToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"fontWeight"``, [`FontWeightValue`](plaited_token_types.md#fontweightvalue)\>

#### Defined in

[index.ts:428](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L428)

___

### FontWeightValue

Ƭ **FontWeightValue**: ``100`` \| ``200`` \| ``300`` \| ``400`` \| ``500`` \| ``600`` \| ``700`` \| ``800`` \| ``900`` \| ``"normal"`` \| ``"bold"`` \| ``"lighter"`` \| ``"bolder"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontWeight value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:271](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L271)

___

### GapToken

Ƭ **GapToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"gap"``, [`GapValue`](plaited_token_types.md#gapvalue)\>

#### Defined in

[index.ts:405](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L405)

___

### GapValue

Ƭ **GapValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue) \| \`${number}%\`

Gap value type relies on the gap formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:152](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L152)

___

### GradientToken

Ƭ **GradientToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"gradient"``, [`GradientValue`](plaited_token_types.md#gradientvalue)\>

#### Defined in

[index.ts:384](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L384)

___

### GradientValue

Ƭ **GradientValue**: { `angleShapePosition?`: `string` ; `colorStops`: { `color?`: [`ColorValue`](plaited_token_types.md#colorvalue) ; `position?`: `string`  }[] ; `gradientFunction`: ``"linear-gradient"`` \| ``"radial-gradient"`` \| ``"conic-gradient"`` \| ``"repeating-linear-gradient"`` \| ``"repeating-radial-gradient"`` \| ``"repeating-conic-gradient"``  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Gradient value type relies on the gradient formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:60](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L60)

___

### GridAutoFlowToken

Ƭ **GridAutoFlowToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"gridAutoFlow"``, [`GridAutoFlowValue`](plaited_token_types.md#gridautoflowvalue)\>

#### Defined in

[index.ts:407](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L407)

___

### GridAutoFlowValue

Ƭ **GridAutoFlowValue**: ``"row"`` \| ``"column"`` \| ``"row dense"`` \| ``"column dense"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

GridAutoFlow value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:156](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L156)

___

### GridMinMaxArgs

Ƭ **GridMinMaxArgs**: `number` \| \`${number}fr\` \| \`${number}%\` \| ``"auto"`` \| ``"min-content"`` \| ``"max-content"``

#### Defined in

[index.ts:163](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L163)

___

### GridTemplateAreasValue

Ƭ **GridTemplateAreasValue**: \`"${string}"\`[]

#### Defined in

[index.ts:170](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L170)

___

### GridTemplateAxisValue

Ƭ **GridTemplateAxisValue**: [`GridMinMaxArgs`](plaited_token_types.md#gridminmaxargs) \| { `function`: ``"minmax"`` ; `range`: [[`GridMinMaxArgs`](plaited_token_types.md#gridminmaxargs), [`GridMinMaxArgs`](plaited_token_types.md#gridminmaxargs)]  } \| { `function`: ``"fit-content"`` ; `value`: \`${number}%\` \| `number`  }

#### Defined in

[index.ts:171](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L171)

___

### GridTemplateRowsOrColumnsValue

Ƭ **GridTemplateRowsOrColumnsValue**: ([`GridTemplateAxisValue`](plaited_token_types.md#gridtemplateaxisvalue) \| { `count`: `number` \| ``"auto-fill"`` \| ``"auto-fit"`` ; `function`: ``"repeat"`` ; `tracks`: [`GridTemplateAxisValue`](plaited_token_types.md#gridtemplateaxisvalue)[]  })[]

#### Defined in

[index.ts:182](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L182)

___

### GridTemplateToken

Ƭ **GridTemplateToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"gridTemplate"``, [`GridTemplateValue`](plaited_token_types.md#gridtemplatevalue)\>

#### Defined in

[index.ts:409](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L409)

___

### GridTemplateValue

Ƭ **GridTemplateValue**: [`GridTemplateAreasValue`](plaited_token_types.md#gridtemplateareasvalue) \| [`GridTemplateRowsOrColumnsValue`](plaited_token_types.md#gridtemplaterowsorcolumnsvalue)

GridTemplate value type relies on the gridTemplate formatter for css tokens
and the defaultFormat formatter for ts tokens
It is used to store grid-template-areas | grid-template-columns | grid-template-rows values

#### Defined in

[index.ts:192](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L192)

___

### GridToken

Ƭ **GridToken**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `$context?` | `never` |
| `$description` | `string` |
| `$type` | ``"grid"`` |
| `$value` | [`GridValue`](plaited_token_types.md#gridvalue) |

#### Defined in

[index.ts:411](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L411)

___

### GridValue

Ƭ **GridValue**: { `alignContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `alignItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `columnGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `display`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoColumns?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoFlow?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridAutoRows?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateAreas?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateColumns?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `gridTemplateRows?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyContent?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `justifyItems?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `rowGap?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Grid value type used for applying aliased grid rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:201](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L201)

___

### LetterSpacingToken

Ƭ **LetterSpacingToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"letterSpacing"``, [`LetterSpacingValue`](plaited_token_types.md#letterspacingvalue)\>

#### Defined in

[index.ts:430](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L430)

___

### LetterSpacingValue

Ƭ **LetterSpacingValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:290](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L290)

___

### LineHeightToken

Ƭ **LineHeightToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"lineHeight"``, [`LineHeightValue`](plaited_token_types.md#lineheightvalue)\>

#### Defined in

[index.ts:432](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L432)

___

### LineHeightValue

Ƭ **LineHeightValue**: [`DimensionValue`](plaited_token_types.md#dimensionvalue)

FontFamily value type relies on the dimension formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:295](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L295)

___

### PercentageRatioToken

Ƭ **PercentageRatioToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"percentageRatio"``, [`PercentageRatioValue`](plaited_token_types.md#percentageratiovalue)\>

#### Defined in

[index.ts:386](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L386)

___

### PercentageRatioValue

Ƭ **PercentageRatioValue**: \`${number}:${number}\` \| \`${number}%\` \| ``1`` \| ``0`` \| \`0.${number}\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

PercentageRatio value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:78](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L78)

___

### PrimitiveLikeTokens

Ƭ **PrimitiveLikeTokens**: [`PrimitiveToken`](plaited_token_types.md#primitivetoken) \| [`PercentageRatioToken`](plaited_token_types.md#percentageratiotoken) \| [`AlignItemsToken`](plaited_token_types.md#alignitemstoken) \| [`DisplayToken`](plaited_token_types.md#displaytoken) \| [`DistributeContentToken`](plaited_token_types.md#distributecontenttoken) \| [`FlexDirectionToken`](plaited_token_types.md#flexdirectiontoken) \| [`FlexWrapToken`](plaited_token_types.md#flexwraptoken) \| [`GridAutoFlowToken`](plaited_token_types.md#gridautoflowtoken) \| [`TimingToken`](plaited_token_types.md#timingtoken) \| [`FontStyleToken`](plaited_token_types.md#fontstyletoken) \| [`FontWeightToken`](plaited_token_types.md#fontweighttoken) \| [`TextTransformToken`](plaited_token_types.md#texttransformtoken)

#### Defined in

[index.ts:489](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L489)

___

### PrimitiveLikeValues

Ƭ **PrimitiveLikeValues**: [`PrimitiveValue`](plaited_token_types.md#primitivevalue) \| [`PercentageRatioValue`](plaited_token_types.md#percentageratiovalue) \| [`AlignItemsValue`](plaited_token_types.md#alignitemsvalue) \| [`DisplayValue`](plaited_token_types.md#displayvalue) \| [`DistributeContentValue`](plaited_token_types.md#distributecontentvalue) \| [`FlexDirectionValue`](plaited_token_types.md#flexdirectionvalue) \| [`FlexWrapValue`](plaited_token_types.md#flexwrapvalue) \| [`GridAutoFlowValue`](plaited_token_types.md#gridautoflowvalue) \| [`TimingValue`](plaited_token_types.md#timingvalue) \| [`FontStyleValue`](plaited_token_types.md#fontstylevalue) \| [`FontWeightValue`](plaited_token_types.md#fontweightvalue) \| [`TextTransformValue`](plaited_token_types.md#texttransformvalue)

#### Defined in

[index.ts:503](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L503)

___

### PrimitiveToken

Ƭ **PrimitiveToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"primitive"``, [`PrimitiveValue`](plaited_token_types.md#primitivevalue)\>

#### Defined in

[index.ts:374](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L374)

___

### PrimitiveValue

Ƭ **PrimitiveValue**: `string` \| `number` \| (`string` \| `number`)[] \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Primitive value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:9](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L9)

___

### StaticToken

Ƭ **StaticToken**<`T`, `V`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |
| `V` | extends [`DesignValue`](plaited_token_types.md#designvalue) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `$context?` | `never` |
| `$description` | `string` |
| `$type` | `T` |
| `$value` | `V` |

#### Defined in

[index.ts:357](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L357)

___

### TextTransformToken

Ƭ **TextTransformToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"textTransform"``, [`TextTransformValue`](plaited_token_types.md#texttransformvalue)\>

#### Defined in

[index.ts:434](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L434)

___

### TextTransformValue

Ƭ **TextTransformValue**: ``"none"`` \| ``"capitalize"`` \| ``"uppercase"`` \| ``"lowercase"`` \| ``"full-width"`` \| ``"full-size-kana"`` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontWeight value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:299](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L299)

___

### TimingToken

Ƭ **TimingToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"timing"``, [`TimingValue`](plaited_token_types.md#timingvalue)\>

#### Defined in

[index.ts:418](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L418)

___

### TimingValue

Ƭ **TimingValue**: \`${number}s\` \| \`${number}ms\` \| [`AliasValue`](plaited_token_types.md#aliasvalue)

FontStyle value type relies on the defaultFormat formatter for ts tokens and css tokens

#### Defined in

[index.ts:223](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L223)

___

### TransitionToken

Ƭ **TransitionToken**: [`BaseToken`](plaited_token_types.md#basetoken)<``"transition"``, [`TransitionValue`](plaited_token_types.md#transitionvalue)\>

#### Defined in

[index.ts:420](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L420)

___

### TransitionValue

Ƭ **TransitionValue**: { `delay?`: [`TimingValue`](plaited_token_types.md#timingvalue) ; `duration`: [`TimingValue`](plaited_token_types.md#timingvalue) ; `timingFunction?`: ``"ease"`` \| ``"linear"`` \| ``"ease-in"`` \| ``"ease-out"`` \| ``"ease-in-out"`` \| ``"step-start"`` \| ``"step-end"`` \| { `function`: ``"steps"`` \| ``"cubic-bezier"`` ; `values`: (`string` \| `number`)[]  }  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Transition value type relies on the transition formatter for css tokens
and the defaultFormat formatter for ts tokens

#### Defined in

[index.ts:228](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L228)

___

### TypographyToken

Ƭ **TypographyToken**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `$context?` | `never` |
| `$description` | `string` |
| `$type` | ``"typography"`` |
| `$value` | [`TypographyValue`](plaited_token_types.md#typographyvalue) |

#### Defined in

[index.ts:436](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L436)

___

### TypographyValue

Ƭ **TypographyValue**: { `fontFamily`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontSize`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontStyle?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `fontWeight`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `letterSpacing?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `lineHeight?`: [`AliasValue`](plaited_token_types.md#aliasvalue) ; `textTransform?`: [`AliasValue`](plaited_token_types.md#aliasvalue)  } \| [`AliasValue`](plaited_token_types.md#aliasvalue)

Typography value type used for applying aliased typography rules inline in TS or
with the tokensGet postCSS plugin as a nested set of css rules.
Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.

#### Defined in

[index.ts:312](https://github.com/plaited/plaited/blob/65db093/libs/token-types/src/index.ts#L312)
