<?php
declare(strict_types=1);

namespace Loxya\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @mixin \Illuminate\Database\Eloquent\Builder
 *
 * @method null|static first($columns = ['*'])
 * @method static firstOrNew(array $attributes = [], array $values = [])
 * @method static firstOrFail($columns = ['*'])
 * @method static firstOrCreate(array $attributes, array $values = [])
 * @method static firstOr($columns = ['*'], ?\Closure $callback = null)
 * @method static firstWhere($column, $operator = null, $value = null, $boolean = 'and')
 * @method static updateOrCreate(array $attributes, array $values = [])
 *
 * @method static \Illuminate\Database\Eloquent\Builder|static query()
 * @method static \Illuminate\Database\Eloquent\Builder|static select($columns = ['*'])
 * @method static \Illuminate\Database\Eloquent\Builder|static selectRaw(string $expression, array $bindings = [])
 * @method static \Illuminate\Database\Eloquent\Builder|static orderBy($column, string $direction = 'asc')
 * @method static \Illuminate\Database\Eloquent\Builder|static where($column, $operator = null, $value = null, string $boolean = 'and')
 * @method static \Illuminate\Database\Eloquent\Builder|static whereNotIn(string $column, $values, string $boolean = 'and')
 * @method static \Illuminate\Database\Eloquent\Builder|static whereBelongsTo(\Illuminate\Database\Eloquent\Model|\Illuminate\Database\Eloquent\Collection<\Illuminate\Database\Eloquent\Model> $related, string|null $relationshipName = null, string $boolean = 'and')
 * @method static \Illuminate\Database\Eloquent\Builder|static orWhereBelongsTo(\Illuminate\Database\Eloquent\Model|\Illuminate\Database\Eloquent\Collection<\Illuminate\Database\Eloquent\Model> $related, string|null $relationshipName = null)
 * @method static \Illuminate\Database\Eloquent\Builder|static whereIn(string $column, $values, string $boolean = 'and', bool $not = false)
 *
 * @method static static make(array $attributes = [])
 * @method static static create(array $attributes = [])
 * @method static static forceCreate(array $attributes)
 * @method static static findOrFail($id, $columns = ['*'])
 * @method static static findOrNew($id, $columns = ['*'])
 * @method static static firstOrNew(array $attributes = [], array $values = [])
 * @method static static firstOrFail($columns = ['*'])
 * @method static static firstOrCreate(array $attributes, array $values = [])
 * @method static static firstOr($columns = ['*'], \Closure $callback = null)
 * @method static static firstWhere($column, $operator = null, $value = null, $boolean = 'and')
 * @method static static updateOrCreate(array $attributes, array $values = [])
 * @method static \Illuminate\Database\Eloquent\Collection|static[] get($columns = ['*'])
 * @method static static|null find($id, $columns = ['*'])
 * @method static static|null first($columns = ['*'])
 * @method static int count(string $columns = '*')
 */
abstract class BasePivot extends Pivot
{
}
